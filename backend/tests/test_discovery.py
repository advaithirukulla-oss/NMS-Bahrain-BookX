"""Isolated integration coverage. Never connects to the configured production database."""
import os
import tempfile
import unittest
from pathlib import Path
import sys

TEMP = tempfile.TemporaryDirectory()
os.environ['DATABASE_URL'] = 'sqlite:///' + str(Path(TEMP.name) / 'test.db').replace('\\', '/')
os.environ['ENVIRONMENT'] = 'test'
os.environ['ENABLE_DB_INIT'] = 'true'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.exc import IntegrityError
import main
import models
from database import engine, SessionLocal

@event.listens_for(engine, 'connect')
def foreign_keys(connection, _):
    connection.execute('PRAGMA foreign_keys=ON')

class DiscoveryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)
        cls.client.__enter__()
        cls.headers = []
        cls.users = []
        for index in range(3):
            payload = dict(name=f'Test Student {index}', email=f'discovery{index}@nmsedu.bh', password='TestOnly123!', grade='7', section='A', accepted_terms=True)
            response = cls.client.post('/register', json=payload)
            assert response.status_code == 200, response.text
            cls.users.append(response.json()['user']['id'])
            login = cls.client.post('/login', json={key: payload[key] for key in ['email', 'password']})
            assert login.status_code == 200
            cls.headers.append({'Authorization': 'Bearer ' + login.json()['access_token']})
        cls.book = cls.client.post('/books', headers=cls.headers[0], json=dict(title='Science Grade 7', subject='Science', grade='7', condition='Good', description='A useful science book.', is_syllabus_book=True, owner_id=cls.users[2])).json()['book']

    @classmethod
    def tearDownClass(cls):
        cls.client.__exit__(None, None, None)
        engine.dispose()
        TEMP.cleanup()

    def test_01_additive_schema_and_auth(self):
        tables = inspect(engine).get_table_names()
        self.assertEqual(set(tables), {'users', 'books', 'book_requests', 'messages', 'saved_books'})
        main.initialize_database()
        self.assertEqual(self.book['owner_id'], self.users[0])
        for method, path in [('get', '/saved-books'), ('post', f'/saved-books/{self.book["id"]}'), ('delete', f'/saved-books/{self.book["id"]}'), ('get', f'/books/{self.book["id"]}')]:
            self.assertEqual(getattr(self.client, method)(path).status_code, 401)
        self.assertEqual(self.client.post('/saved-books/999999', headers=self.headers[1]).status_code, 404)

    def test_01_existing_schema_upgrade_preserves_rows(self):
        legacy = create_engine('sqlite:///' + str(Path(TEMP.name) / 'legacy.db').replace('\\', '/'))
        tables = [table for table in models.Base.metadata.sorted_tables if table.name != 'saved_books']
        models.Base.metadata.create_all(legacy, tables=tables)
        with legacy.begin() as connection:
            connection.execute(models.User.__table__.insert().values(id=1, name='Preserved', email='legacy@nmsedu.bh', trust_points=40))
            connection.execute(models.Book.__table__.insert().values(id=1, owner_id=1, title='Existing book', status='reserved'))
            before = connection.execute(text("SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name")).all()
        models.Base.metadata.create_all(legacy)
        models.Base.metadata.create_all(legacy)
        with legacy.connect() as connection:
            after = connection.execute(text("SELECT name, sql FROM sqlite_master WHERE type='table' AND name != 'saved_books' ORDER BY name")).all()
            self.assertEqual(before, after)
            self.assertEqual(connection.execute(text('SELECT trust_points FROM users')).scalar(), 40)
            self.assertEqual(connection.execute(text('SELECT status FROM books')).scalar(), 'reserved')
        legacy.dispose()

    def test_02_saved_persistence_uniqueness_isolation(self):
        path = f'/saved-books/{self.book["id"]}'
        for _ in range(2):
            self.assertEqual(self.client.post(path, headers=self.headers[1], json={'user_id': self.users[2]}).status_code, 200)
        self.assertEqual(len(self.client.get('/saved-books', headers=self.headers[1]).json()), 1)
        self.assertEqual(self.client.get('/saved-books', headers=self.headers[2]).json(), [])
        self.client.delete(path, headers=self.headers[2])
        self.assertEqual(len(self.client.get('/saved-books', headers=self.headers[1]).json()), 1)
        with SessionLocal() as db:
            self.assertEqual(db.query(models.SavedBook).count(), 1)
            db.add(models.SavedBook(user_id=self.users[1], book_id=self.book['id']))
            with self.assertRaises(IntegrityError): db.commit()
            db.rollback()
            db.add(models.SavedBook(user_id=self.users[1], book_id=99999))
            with self.assertRaises(IntegrityError): db.commit()
            db.rollback()
        self.client.delete(path, headers=self.headers[1])
        self.client.delete(path, headers=self.headers[1])
        self.assertEqual(self.client.get('/saved-books', headers=self.headers[1]).json(), [])

    def test_03_requests_availability_activity_notifications(self):
        book_id = self.book['id']
        self.client.post(f'/saved-books/{book_id}', headers=self.headers[1])
        self.assertEqual(self.client.post('/requests', headers=self.headers[0], json={'book_id': book_id}).status_code, 400)
        request = self.client.post('/requests', headers=self.headers[1], json={'book_id': book_id}).json()
        request_id = request['request_id']
        self.assertEqual(self.client.post('/requests', headers=self.headers[1], json={'book_id': book_id}).status_code, 400)
        self.assertEqual(self.client.put(f'/requests/{request_id}', headers=self.headers[2], json={'status': 'approved'}).status_code, 403)
        owner_notifications = self.client.get(f'/notifications/{self.users[0]}', headers=self.headers[0]).json()['notifications']
        self.assertEqual(owner_notifications[0]['book_id'], book_id)
        self.assertEqual(owner_notifications[0]['target'], 'my-books')
        stranger = self.client.get(f'/books/{book_id}', headers=self.headers[2]).json()
        self.assertEqual(stranger['activity'], [])
        self.assertEqual(self.client.put(f'/requests/{request_id}', headers=self.headers[0], json={'status': 'approved'}).status_code, 200)
        saved = self.client.get('/saved-books', headers=self.headers[1]).json()
        self.assertEqual(saved[0]['status'], 'reserved')
        self.assertEqual(self.client.post('/requests', headers=self.headers[2], json={'book_id': book_id}).status_code, 400)
        activity = self.client.get(f'/books/{book_id}', headers=self.headers[1]).json()['activity']
        self.assertEqual(activity[0]['status'], 'approved')
        notifications = self.client.get(f'/notifications/{self.users[1]}', headers=self.headers[1]).json()['notifications']
        self.assertEqual(notifications[0]['request_id'], request_id)
        self.assertEqual(notifications[0]['title'], 'Request accepted')
        self.assertEqual(len({item['id'] for item in notifications}), len(notifications))
        self.assertEqual(self.client.get(f'/notifications/{self.users[1]}', headers=self.headers[2]).status_code, 403)

    def test_04_profile_message_and_upload_regressions(self):
        response = self.client.patch('/profile', headers=self.headers[1], json={'grade': 'KG 2', 'section': 'B'})
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(self.client.get(f'/profile/{self.users[1]}', headers=self.headers[1]).json()['grade'], 'KG 2')
        message = self.client.post('/messages', headers=self.headers[0], json={'receiver_id': self.users[1], 'message_text': 'Test exchange message.'})
        self.assertEqual(message.status_code, 200)
        note = next(item for item in self.client.get(f'/notifications/{self.users[1]}', headers=self.headers[1]).json()['notifications'] if item['type'] == 'new_message')
        self.assertEqual(note['conversation']['user_id'], self.users[0])
        self.assertEqual(self.client.put(f'/messages/read/{message.json()["message_id"]}', headers=self.headers[2]).status_code, 403)
        upload = self.client.post('/books', headers=self.headers[0], data=dict(title='English KG 2', subject='English', grade='KG 2', condition='Good', description='Reading practice book.', is_syllabus_book='true'), files={'image': ('cover.png', b'\x89PNG\r\n\x1a\n' + b'test', 'image/png')})
        self.assertEqual(upload.status_code, 200, upload.text)
        image_path = main.UPLOAD_DIR / Path(upload.json()['book']['image_url']).name
        image_path.unlink()

if __name__ == '__main__': unittest.main(verbosity=2)
