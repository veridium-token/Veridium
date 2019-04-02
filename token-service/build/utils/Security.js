"use strict";

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const crypto = require('crypto');

module.exports = class Security {

    encrypt(stringToEncrypt, password, salt) {
        return _asyncToGenerator(function* () {

            let derivedKey = crypto.pbkdf2Sync(password, salt, 10000, 32, "sha256");

            // encrypt the Text
            let cipher = crypto.createCipheriv("aes-256-gcm", derivedKey, '00000000000000000000000000000000');
            let encrypted = cipher.update(stringToEncrypt, "utf8", "base64");
            encrypted += cipher.final("base64");
            return encrypted;
        })();
    }

    decrypt(encryptedString, password, salt) {
        return _asyncToGenerator(function* () {
            let derivedKey = crypto.pbkdf2Sync(password, salt, 10000, 32, "sha256");

            // decrypt the Text
            let decipher = crypto.createDecipheriv("aes-256-gcm", derivedKey, '00000000000000000000000000000000');
            let decrypted = decipher.update(encryptedString, "base64", "utf8");
            return decrypted;
        })();
    }
};

// const Security = module.exports;
// const security =  new Security();

// test = async function(){
//     let salt = crypto.randomBytes(128);
//     const encrypted = await security.encrypt ("toddkaplinger", "password", "1234");
//     console.log('encrypted', encrypted)

//     const decrypted =  await security.decrypt (encrypted, "password", "1234");
//     console.log('decrypted', decrypted)
//     console.log("toddkaplinger".localeCompare(decrypted) === 0 ? "yes" : "no");
// }

// test();
//# sourceMappingURL=Security.js.map