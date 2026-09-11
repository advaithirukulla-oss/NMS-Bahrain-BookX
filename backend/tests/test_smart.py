"""Smart features exercise isolated SQLite fixtures from the regression harness."""
from unittest.mock import patch
from database import SessionLocal
import models
import smart

class SmartTestCases:
    def setUp(self):
        smart._calls.clear()

    def test_intent(self):
        for text, grade, subject in [('easy science for Grade 7', '7', 'Science'), ('English books for KG 2', 'KG 2', 'English'), ('math practice for class 8', '8', 'Mathematics'), ('KG1 Arabic', 'KG 1', 'Arabic')]:
            parsed = smart.intent(text)
            self.assertEqual((parsed['grade'], parsed['subject']), (grade, subject))
        self.assertEqual(smart.intent('something adventurous')['themes'], ['adventure'])
        self.assertEqual(smart.intent('easy science')['difficulty'], 'easy')
        self.assertEqual(smart.intent('all science include unavailable')['availability'], 'all')

    def test_grounding_privacy_and_availability(self):
        def find(query, who=1, **extra):
            response = self.client.post('/smart/find', headers=self.headers[who], json={'query': query, **extra})
            self.assertEqual(response.status_code, 200, response.text)
            return response.json()
        book = self.client.post('/books', headers=self.headers[0], json=dict(title='Smart QA adventure science', subject='Science', grade='7', condition='Good', description='An easy adventure through science.', is_syllabus_book=True)).json()['book']
        result = find('easy science Grade 7')
        self.assertIn(book['id'], [m['book']['id'] for m in result['results']])
        self.assertTrue(all(m['book']['status'] == 'available' and m['book']['owner_id'] != self.users[1] for m in result['results']))
        self.assertNotIn(book['id'], [m['book']['id'] for m in find('science Grade 7', 0)['results']])
        self.client.post(f'/saved-books/{book["id"]}', headers=self.headers[1])
        self.assertTrue(find('similar to science books I saved')['results'])
        self.assertFalse(find('similar to books I saved', 2)['results'])
        recent = find('similar to recently viewed books', recent_ids=[book['id']])
        self.assertTrue(recent['results'])
        self.assertIn('recently viewed', recent['results'][0]['reason'])
        self.assertTrue(find('something adventurous')['results'])
        with SessionLocal() as db:
            db.query(models.Book).filter_by(id=book['id']).update({'status':'given'}); db.commit()
        self.assertNotIn(book['id'], [m['book']['id'] for m in find('science Grade 7')['results']])
        unavailable = find('unavailable science Grade 7')['results']
        self.assertTrue(any(m['book']['id'] == book['id'] and m['book']['status'] == 'given' for m in unavailable))
        no_match = find('xylophone encyclopaedia')
        self.assertEqual(no_match['results'], [])
        self.assertTrue(all(isinstance(idea, str) for idea in no_match['general_suggestions']))

    def test_listing_is_review_only(self):
        with SessionLocal() as db: before = db.query(models.Book).count()
        response = self.client.post('/smart/listing', headers=self.headers[1], json={'text':'Grade 7 science textbook, good condition, a few pencil marks', 'title':'My existing title'})
        self.assertEqual(response.status_code, 200)
        suggestions = response.json()['suggestions']
        self.assertEqual(suggestions['grade'], '7')
        self.assertEqual(suggestions['subject'], 'Science')
        self.assertEqual(suggestions['condition'], 'Good')
        self.assertNotIn('title', suggestions)
        self.assertIn('pencil marks', suggestions['description'])
        with SessionLocal() as db: self.assertEqual(db.query(models.Book).count(), before)
        draft = self.client.post('/smart/listing', headers=self.headers[1], json={'mode':'description', 'title':'Science', 'grade':'7', 'condition':'Used'}).json()['suggestions']['description']
        self.assertNotIn('excellent', draft.lower())
        self.assertNotIn('edition', draft.lower())

    def test_auth_validation_missing_provider_and_rate(self):
        self.assertEqual(self.client.post('/smart/find', json={'query':'science'}).status_code, 401)
        self.assertEqual(self.client.post('/smart/listing', json={'text':'science'}).status_code, 401)
        for payload in [{'query':'x'*501}, {'query':'  '}, {'query':'science Grade 13'}, {'query':'English KG 3'}, {'query':'science','user_id':self.users[0]}, {'query':'science','recent_ids':list(range(21))}]:
            self.assertEqual(self.client.post('/smart/find', headers=self.headers[1], json=payload).status_code, 422)
        self.assertEqual(self.client.post('/smart/listing', headers=self.headers[1], json={'image':'invalid fake image'}).status_code, 422)
        self.assertEqual(self.client.post('/smart/listing', headers=self.headers[1], files={'image':('fake.png',b'not an image','image/png')}).status_code, 422)
        capabilities = self.client.get('/smart/capabilities', headers=self.headers[1]).json()
        self.assertFalse(capabilities['vision'])
        with patch.dict('os.environ', {'OPENAI_API_KEY':'invalid-test-only'}):
            self.assertEqual(self.client.post('/smart/find', headers=self.headers[1], json={'query':'science'}).json()['mode'], 'deterministic')
        for _ in range(19): self.client.post('/smart/listing', headers=self.headers[1], json={'text':'science'})
        limited = self.client.post('/smart/listing', headers=self.headers[1], json={'text':'science'})
        self.assertEqual(limited.status_code, 429)
        self.assertEqual(limited.headers['retry-after'], '60')
