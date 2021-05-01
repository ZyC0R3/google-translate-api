const test = require('ava');
const Configstore = require('configstore');
const translate = require('./index.js');

const config = new Configstore('google-translate-api');

test.beforeEach(() => {
    config.clear();
});

test('translate from en to ps (Pashto) - Hello', async t => {
    const results = await translate('hello', {from: 'en', to: 'ps'});

    t.is(results.text, 'سلام');
});

test('translate from en to sq (Albanian) - Hello', async t => {
    const results = await translate('hello', {from: 'en', to: 'sq'});

    t.is(results.text, 'Përshëndetje');
});

test('translate from en to ar (Arabic) - Hello', async t => {
    const results = await translate('hello', {from: 'en', to: 'ar'});

    t.is(results.text, 'مرحبا');
});
