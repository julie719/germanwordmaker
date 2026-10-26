import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compoundBreaks, hyphenate, splitExample, ratingLabel } from '../assets/text.js';

test('compoundBreaks finds part boundaries, including verbs and linking letters', () => {
  const parts = [{ german: 'Schutzfolie' }, { german: 'abziehen' }, { german: 'Freude' }];
  assert.deepEqual(compoundBreaks('Schutzfolienabziehfreude', parts), [12, 18]);
  assert.equal(hyphenate('Schutzfolienabziehfreude', parts), 'Schutzfolien­abzieh­freude');
});

test('compoundBreaks handles a long seven-part word', () => {
  const word = 'Montagmorgenbesprechungskameraeinschaltverweigerungsgemeinschaftsgefühl';
  const parts = ['Montag', 'Morgen', 'Besprechung', 'Kamera', 'einschalten', 'Verweigerung', 'Gemeinschaftsgefühl']
    .map(german => ({ german }));
  const pieces = hyphenate(word, parts).split('­');
  assert.deepEqual(pieces, ['Montag', 'morgen', 'besprechungs', 'kamera', 'einschalt', 'verweigerungs', 'gemeinschaftsgefühl']);
});

test('compoundBreaks skips parts it cannot find and never breaks at the edges', () => {
  assert.deepEqual(compoundBreaks('Häuserblock', [{ german: 'Haus' }, { german: 'Block' }]), [6]);
  assert.deepEqual(compoundBreaks('Wortspiel', [{ german: 'Wort' }, { german: 'Umlaut' }]), []);
  assert.deepEqual(compoundBreaks('Eiweiß', [{ german: 'Ei' }, { german: 'weiß' }]), [2]);
  assert.deepEqual(compoundBreaks('Kaffee', []), []);
  assert.deepEqual(compoundBreaks('Kaffee', [{}, { german: null }]), []);
});

test('splitExample separates the German sentence from the English translation', () => {
  assert.deepEqual(
    splitExample('Ich habe den Kaffeekipppunkt verpasst. (I missed the coffee tipping point.)'),
    { german: 'Ich habe den Kaffeekipppunkt verpasst.', english: 'I missed the coffee tipping point.' }
  );
});

test('splitExample keeps nested parentheses in the translation', () => {
  assert.deepEqual(
    splitExample('Es war „erfolgreich“ (100%). (It was "successful" (100%).)'),
    { german: 'Es war „erfolgreich“ (100%).', english: 'It was "successful" (100%).' }
  );
});

test('splitExample falls back to the whole text when there is no translation', () => {
  assert.deepEqual(splitExample('Nur Deutsch.'), { german: 'Nur Deutsch.', english: '' });
  assert.deepEqual(splitExample('(Only English.)'), { german: '(Only English.)', english: '' });
  assert.deepEqual(splitExample('Unbalanced text)'), { german: 'Unbalanced text)', english: '' });
  assert.deepEqual(splitExample(undefined), { german: '', english: '' });
});

test('ratingLabel', () => {
  assert.equal(ratingLabel({ avg: 0, count: 0 }), 'No ratings yet');
  assert.equal(ratingLabel({ avg: 4, count: 1 }), '4.0 from 1 rating');
  assert.equal(ratingLabel({ avg: 4.25, count: 12 }), '4.3 from 12 ratings');
});
