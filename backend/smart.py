"""Catalogue-grounded assistance. No external provider or personal-data transmission."""
import re
import time
from collections import OrderedDict, deque
from threading import Lock
from pydantic import BaseModel, ConfigDict, Field, field_validator
from fastapi import HTTPException
from sqlalchemy import or_, func
import models

SUBJECTS = {'Science': ['science'], 'Mathematics': ['math', 'maths', 'mathematics'], 'English': ['english'], 'Arabic': ['arabic'], 'Biology': ['biology'], 'Chemistry': ['chemistry'], 'Physics': ['physics'], 'History': ['history'], 'Geography': ['geography'], 'Computer': ['computer', 'ict']}
THEMES = {'adventure': ['adventure', 'adventurous'], 'mystery': ['mystery', 'mysteries'], 'space': ['space'], 'animals': ['animal', 'animals'], 'practice': ['practice', 'workbook', 'exercises'], 'reading': ['reading', 'reader', 'stories', 'story']}
STOP = set('i need want something a an the book books for please show me grade class year kg similar like those to saved recently viewed my easy beginner simple advanced challenging available unavailable reserved given all include only now and in of textbook condition good excellent used'.split())

class FinderInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    query: str = Field(min_length=2, max_length=500)
    recent_ids: list[int] = Field(default_factory=list, max_length=20)

    @field_validator('query')
    @classmethod
    def clean(cls, value):
        value = value.strip()
        if len(value) < 2: raise ValueError('Enter at least two characters.')
        grade = re.search(r'\b(?:grade|class|year|kg)\s*(\d+)\b', value, re.I)
        if grade and (not 1 <= int(grade[1]) <= 12 or grade[0].lower().startswith('kg') and int(grade[1]) > 2):
            raise ValueError('Use KG 1, KG 2 or Grade 1–12.')
        return value

class ListingInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    text: str = Field(default='', max_length=500)
    title: str = Field(default='', max_length=150)
    subject: str = Field(default='', max_length=100)
    grade: str = Field(default='', max_length=10)
    condition: str = Field(default='', max_length=20)
    description: str = Field(default='', max_length=500)
    mode: str = Field(default='text', pattern='^(text|description)$')

_calls = OrderedDict()
_lock = Lock()
def rate_limit(user_id):
    now = time.monotonic()
    with _lock:
        while _calls and next(iter(_calls.values()))[-1] <= now - 60:
            _calls.popitem(last=False)
        calls = _calls.setdefault(user_id, deque())
        while calls and calls[0] <= now - 60: calls.popleft()
        if len(calls) >= 20:
            raise HTTPException(429, 'Please wait a minute before asking for more suggestions.', headers={'Retry-After': '60'})
        calls.append(now)
        _calls.move_to_end(user_id)
        if len(_calls) > 10000: _calls.popitem(last=False)

def words(text):
    return set(re.findall(r'[a-z]+', text.lower()))

def intent(text):
    tokens = words(text)
    kg = re.search(r'\bkg\s*([12])\b', text, re.I)
    grade = re.search(r'\b(?:grade|class|year)\s*(1[0-2]|[1-9])\b', text, re.I)
    subject = next((name for name, aliases in SUBJECTS.items() if tokens.intersection(aliases)), None)
    themes = [name for name, aliases in THEMES.items() if tokens.intersection(aliases)]
    difficulty = 'easy' if tokens.intersection({'easy', 'beginner', 'simple'}) else 'advanced' if tokens.intersection({'advanced', 'challenging'}) else None
    aliases = {v for values in SUBJECTS.values() for v in values} | {v for values in THEMES.values() for v in values}
    return dict(grade=f'KG {kg[1]}' if kg else grade[1] if grade else None, subject=subject, themes=themes, difficulty=difficulty,
                signal='saved' if 'saved' in tokens else 'recent' if tokens.intersection({'recently', 'viewed'}) else None,
                availability='all' if re.search(r'\b(?:all|include unavailable)\b', text, re.I) else 'unavailable' if tokens.intersection({'unavailable', 'reserved', 'given'}) else 'available',
                keywords=sorted(tokens - STOP - aliases)[:12])

def find_books(db, user, data):
    parsed = intent(data.query)
    query = db.query(models.Book).filter(models.Book.owner_id != user.id)
    if parsed['grade']: query = query.filter(models.Book.grade == parsed['grade'])
    if parsed['availability'] == 'available': query = query.filter(models.Book.status == 'available')
    elif parsed['availability'] == 'unavailable': query = query.filter(models.Book.status.in_(['reserved', 'given']))
    if parsed['subject']:
        query = query.filter(or_(*[func.lower(models.Book.subject).contains(alias, autoescape=True) for alias in SUBJECTS[parsed['subject']]]))
    signals = []
    if parsed['signal'] == 'saved':
        signals = db.query(models.Book).join(models.SavedBook).filter(models.SavedBook.user_id == user.id).all()
    elif parsed['signal'] == 'recent':
        # IDs are client-supplied catalogue references, never evidence about other users.
        signals = db.query(models.Book).filter(models.Book.id.in_(data.recent_ids)).all()
    signal_subjects = {b.subject.lower() for b in signals}
    if parsed['signal']:
        if signal_subjects: query = query.filter(func.lower(models.Book.subject).in_(signal_subjects))
        else: query = query.filter(models.Book.id == -1)
    terms = parsed['keywords'] + [v for theme in parsed['themes'] for v in THEMES[theme]]
    if terms:
        query = query.filter(or_(*[or_(func.lower(models.Book.title).contains(term, autoescape=True), func.lower(models.Book.description).contains(term, autoescape=True)) for term in terms]))
    matches = []
    for book in query.order_by(models.Book.id.desc()).limit(200).all():
        reasons = []
        score = 0
        if parsed['grade']: reasons.append(f'Matches Grade {book.grade}.' if not book.grade.startswith('KG') else f'Matches {book.grade}.'); score += 4
        if parsed['subject']: reasons.append(f'Listed under {book.subject}.'); score += 4
        if book.subject.lower() in signal_subjects: reasons.append('Similar subject to books you saved.' if parsed['signal'] == 'saved' else 'Similar subject to your recently viewed books.'); score += 3
        if not parsed['grade'] and book.grade == user.grade: reasons.append('Matches your profile grade.'); score += 1
        text_tokens = words(f'{book.title} {book.description}')
        if terms and not text_tokens.intersection(terms):
            continue
        for theme in parsed['themes']:
            if text_tokens.intersection(THEMES[theme]): reasons.append(f'The listing mentions {theme}.'); score += 2
        if parsed['difficulty'] and text_tokens.intersection({'easy', 'beginner', 'simple'} if parsed['difficulty'] == 'easy' else {'advanced', 'challenging'}):
            reasons.append('The listing mentions reading-level words; review its description.'); score += 2
        if parsed['keywords'] and text_tokens.intersection(parsed['keywords']): reasons.append('Matches words in the listing.'); score += 1
        matches.append({'book': book, 'reason': ' '.join(reasons) or 'Matches your availability preference.', '_score': score})
    matches.sort(key=lambda item: (-item['_score'], -item['book'].id))
    for match in matches: match.pop('_score')
    general = []
    if not matches:
        general = ['Try a school reading book with an adventure theme.' if 'adventure' in parsed['themes'] else 'Try a school book in this subject or a neighbouring grade.']
    return {'mode': 'deterministic', 'intent': parsed, 'results': matches[:20], 'general_suggestions': general,
            'note': 'Reading level is only matched when the listing describes it.' if parsed['difficulty'] else ''}

def listing_suggestions(data):
    parsed = intent(data.text)
    suggestions = {}
    if data.mode == 'text':
        if parsed['grade']: suggestions['grade'] = parsed['grade']
        if parsed['subject']: suggestions['subject'] = parsed['subject']
        condition = re.search(r'\b(excellent|good|used)\s+condition\b', data.text, re.I)
        if condition and not re.search(r'\b(?:not|isn.t)\s+(?:in\s+)?(?:excellent|good|used)\s+condition', data.text, re.I):
            suggestions['condition'] = condition[1].capitalize()
        title = re.search(r'(?:\btitle\s*:\s*|[“"])([^"”\n,]{2,150})', data.text, re.I)
        if title: suggestions['title'] = title[1].strip()
        if len(data.text.strip()) >= 8: suggestions['description'] = data.text.strip()
    else:
        parts = []
        if data.title.strip(): parts.append(data.title.strip() + '.')
        if data.subject.strip(): parts.append(f'Subject: {data.subject.strip()}.')
        if data.grade in {'KG 1', 'KG 2', *map(str, range(1,13))}: parts.append(f'For {data.grade if data.grade.startswith("KG") else "Grade " + data.grade}.')
        if data.condition in {'Excellent', 'Good', 'Used'}: parts.append(f'Condition: {data.condition}.')
        if data.description.strip(): parts.append(data.description.strip())
        draft = ' '.join(parts)
        if 8 <= len(draft) <= 500: suggestions['description'] = draft
    return {'mode': 'deterministic', 'suggestions': suggestions, 'note': 'Drafted only from your text. Review every field before applying. Nothing has been posted.'}
