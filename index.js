const querystring = require('querystring');

const got = require('got');

const languages = require('./languages');

function extract(key, results) {
    const re = new RegExp(`"${key}":".*?"`);
    const result = re.exec(results.body);
    if (result !== null) {
        return result[0].replace(`"${key}":"`, '').slice(0, -1);
    }

    return '';
}

function translate(text, options, gotopts) {
    options = options || {};
    gotopts = gotopts || {};
    let error;
    for (const lang of [options.from, options.to]) {
        if (lang && !languages.isSupported(lang)) {
            error = new Error();
            error.code = 400;
            error.message = 'The language \'' + lang + '\' is not supported';
        }
    }

    if (error) {
        return new Promise((resolve, reject) => {
            reject(error);
        });
    }

    options.from = options.from || 'auto';
    options.to = options.to || 'en';
    options.tld = options.tld || 'com';

    options.from = languages.getCode(options.from);
    options.to = languages.getCode(options.to);

    let url = 'https://translate.google.' + options.tld;
    return got(url, gotopts).then(results => {
        const data = {
            rpcids: 'MkEWBc',
            'f.sid': extract('FdrFJe', results),
            bl: extract('cfb2h', results),
            hl: 'en-US',
            'soc-app': 1,
            'soc-platform': 1,
            'soc-device': 1,
            _reqid: Math.floor(1000 + (Math.random() * 9000)),
            rt: 'c'
        };

        return data;
    }).then(data => {
        url = url + '/_/TranslateWebserverUi/data/batchexecute?' + querystring.stringify(data);
        gotopts.body = 'f.req=' + encodeURIComponent(JSON.stringify([[['MkEWBc', JSON.stringify([[text, options.from, options.to, true], [null]]), null, 'generic']]])) + '&';
        gotopts.headers['content-type'] = 'application/x-www-form-urlencoded;charset=UTF-8';

        return got.post(url, gotopts).then(results => {
            let json = results.body.slice(6);
            let length = '';

            const result = {
                text: '',
                pronunciation: '',
                from: {
                    language: {
                        didYouMean: false,
                        iso: ''
                    },
                    text: {
                        autoCorrected: false,
                        value: '',
                        didYouMean: false
                    }
                },
                raw: ''
            };

            try {
                length = /^\d+/.exec(json)[0];
                json = JSON.parse(json.slice(length.length, Number.parseInt(length, 10) + length.length));
                json = JSON.parse(json[0][2]);
                result.raw = json;
            } catch {
                return result;
            }

            if (json[1][0][0][5] === undefined || json[1][0][0][5] === null) {
                // Translation not found, could be a hyperlink or gender-specific translation?
                result.text = json[1][0][0][0];
            } else {
                for (const object of json[1][0][0][5]) {
                    if (object[0]) {
                        result.text += object[0];
                    }
                }
            }

            result.pronunciation = json[1][0][0][1];

            // From language
            if (json[0] && json[0][1] && json[0][1][1]) {
                result.from.language.didYouMean = true;
                result.from.language.iso = json[0][1][1][0];
            } else if (json[1][3] === 'auto') {
                result.from.language.iso = json[2];
            } else {
                result.from.language.iso = json[1][3];
            }

            // Did you mean & autocorrect
            if (json[0] && json[0][1] && json[0][1][0]) {
                let string = json[0][1][0][0][1];

                string = string.replace(/<b>(<i>)?/g, '[');
                string = string.replace(/(<\/i>)?<\/b>/g, ']');

                result.from.text.value = string;

                if (json[0][1][0][2] === 1) {
                    result.from.text.autoCorrected = true;
                } else {
                    result.from.text.didYouMean = true;
                }
            }

            return result;
        }).catch(error => {
            error.message += `\nUrl: ${url}`;
            error.code = error.statusCode !== undefined && error.statusCode !== 200 ? 'BAD_REQUEST' : 'BAD_NETWORK';
            throw error;
        });
    });
}

module.exports = translate;
module.exports.languages = languages;
