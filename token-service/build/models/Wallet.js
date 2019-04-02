'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

/* wallet controller module */
require('../config/initializers/database');
const Account = require('./Account');
const Asset = require('./Asset');

const StellarNetwork = require('./StellarNetwork');
const _stellar = new StellarNetwork();
const StellarSDK = require('stellar-sdk');
const TransactionHandler = require('./TransactionHandler');
const _transactionHandler = new TransactionHandler();
const TransactionOperationBuilder = require('./TransactionOperationBuilder');

const Security = require('../utils/Security');
const _security = new Security();
const crypto = require('crypto');
const bcrypt = require('bcrypt');

const fees = require('./fees.json');

const log4js = require('log4js');
const logger = log4js.getLogger('Wallet');
logger.level = process.env.LOG_LEVEL || 'debug';

const i18n = require('i18n');
const path = require('path');
i18n.configure({
    directory: path.join(__dirname, '/../locales')
});
const _ = require('lodash');

module.exports = class Wallet {
    /* Creating Account */
    bootstrapAccountFromTestNetwork(user, description, passphrase, trustAuthorizationRequired, preAuthorizedTransactions, homeDomain) {
        var _this = this;

        return _asyncToGenerator(function* () {
            logger.trace('bootstrapAccountFromTestNetwork entry', user);
            const keyPair = yield _stellar.bootstrapTestAccount();

            const account = yield _this.registerAccount(user, description, keyPair.publicKey(), keyPair.secret(), passphrase, preAuthorizedTransactions);

            if (trustAuthorizationRequired || homeDomain) {
                // if either exists, we have an additional setOptions transaction
                const loadedAccount = yield _stellar.loadAccount(keyPair.publicKey());
                let txOpBuilder = new TransactionOperationBuilder(loadedAccount);

                if (trustAuthorizationRequired) {
                    let flagsOperation = yield _transactionHandler.composeSetOptionsOperation_Flags(keyPair.publicKey(), 'setFlags', 'AuthRequiredFlag');
                    yield txOpBuilder.addOperation(flagsOperation);
                }

                if (homeDomain) {
                    let domainOperation = yield _transactionHandler.composeSetOptionsOperation_HomeDomain(keyPair.publicKey(), homeDomain);
                    yield txOpBuilder.addOperation(domainOperation);
                }

                let stellarTransaction = yield txOpBuilder.buildTransaction();
                yield _transactionHandler.signTransaction(keyPair.publicKey(), keyPair.secret(), stellarTransaction.id);
            }

            const stellAccount = yield _this._mergeAccountFields(account, keyPair.publicKey());

            logger.trace('bootstrapAccountFromTestNetwork exit');
            return stellAccount;
        })();
    }

    createAccountFromSource(user, description, sourceAcctPublicKey, sourceAcctSecret, passphrase, initialBalance, trustAuthorizationRequired, preAuthorizedTransactions, homeDomain) {
        var _this2 = this;

        return _asyncToGenerator(function* () {
            logger.trace('createAccountFromSource entry', [user, description, sourceAcctPublicKey, sourceAcctSecret, passphrase, initialBalance, trustAuthorizationRequired, preAuthorizedTransactions]);

            const newAcctKeyPair = StellarSDK.Keypair.random();
            let stellAccount = yield _this2.initializeExistingKeypair(user, description, sourceAcctPublicKey, sourceAcctSecret, '0', newAcctKeyPair.publicKey(), newAcctKeyPair.secret(), passphrase, initialBalance, preAuthorizedTransactions);

            if (trustAuthorizationRequired || homeDomain) {
                // if either exists, we have an additional setOptions transaction
                const loadedAccount = yield _stellar.loadAccount(newAcctKeyPair.publicKey());
                let txOpBuilder = new TransactionOperationBuilder(loadedAccount);

                if (trustAuthorizationRequired) {
                    let flagsOperation = yield _transactionHandler.composeSetOptionsOperation_Flags(newAcctKeyPair.publicKey(), 'setFlags', 'AuthRequiredFlag');
                    yield txOpBuilder.addOperation(flagsOperation);
                }

                if (homeDomain) {
                    let domainOperation = yield _transactionHandler.composeSetOptionsOperation_HomeDomain(newAcctKeyPair.publicKey(), homeDomain);
                    yield txOpBuilder.addOperation(domainOperation);
                }

                let stellarTransaction = yield txOpBuilder.buildTransaction();
                yield _transactionHandler.signTransaction(newAcctKeyPair.publicKey(), newAcctKeyPair.secret(), stellarTransaction.id);

                // reload deep copy of the account from stellar after transactions completed
                stellAccount = yield _this2.getAccount(user, newAcctKeyPair.publicKey(), false);
            }

            logger.trace('createAccountFromSource exit');
            return stellAccount;
        })();
    }

    initializeExistingKeypair(user, description, sourceAcctPublicKey, sourceAcctSecret, sourceAcctSequenceNum, existingPublicKey, existingSecret, passphrase, initialBalance, preAuthorizedTransactions) {
        var _this3 = this;

        return _asyncToGenerator(function* () {
            logger.trace('initializeExistingKeypair entry', [user, description, sourceAcctPublicKey, sourceAcctSecret, sourceAcctSequenceNum, existingPublicKey, existingSecret, passphrase, initialBalance, preAuthorizedTransactions]);
            const keypair = StellarSDK.Keypair.fromSecret(sourceAcctSecret);
            if (sourceAcctPublicKey !== keypair.publicKey()) {
                throw new Error(i18n.__('invalid.stellar.keypair'));
            }
            let sourceAcct;
            if (!sourceAcctSequenceNum || sourceAcctSequenceNum === '0') {
                sourceAcct = yield _stellar.loadAccount(sourceAcctPublicKey);
            } else {
                sourceAcct = yield _stellar.loadAccount(sourceAcctPublicKey, sourceAcctSequenceNum);
            }

            let createAccountTransaction = yield _transactionHandler.setupCreateAccountTransaction(sourceAcct, sourceAcctPublicKey, existingPublicKey, initialBalance);

            logger.trace('stellarTransaction', createAccountTransaction.id);
            yield _transactionHandler.signTransaction(sourceAcctPublicKey, sourceAcctSecret, createAccountTransaction.id);
            const account = yield _this3.registerAccount(user, description, existingPublicKey, existingSecret, passphrase, preAuthorizedTransactions);

            const stellAccount = yield _this3._mergeAccountFields(account, existingPublicKey);
            logger.trace('initializeExistingKeypair exit');
            return stellAccount;
        })();
    }

    /* Register Account */
    registerAccount(user, description, accountPublicKey, accountSecret, passphrase, preAuthorizedTransactions) {
        return _asyncToGenerator(function* () {
            logger.trace('registerAccount entry', user);

            const salt = crypto.randomBytes(128).toString('base64');
            const encryptedSecret = yield _security.encrypt(accountSecret, passphrase, salt);
            var encryptedPassphrase = yield bcrypt.hash(passphrase, 10);

            const account = new Account({
                userId: user.id,
                tenantId: user.tenantId,
                email: user.email,
                description: description,
                public_key: accountPublicKey,
                salt: salt,
                encrypted_secret: encryptedSecret,
                passphrase: encryptedPassphrase,
                pre_authorize_transactions: preAuthorizedTransactions
            });

            yield account.save();

            logger.trace('registerAccount exit', account);
            return account;
        })();
    }

    getAccount(user, publicKey, shallowCopy) {
        var _this4 = this;

        return _asyncToGenerator(function* () {
            logger.trace('getAccount entry', [user, publicKey, shallowCopy]);
            const account = yield Account.findOne({ userId: user.id, public_key: publicKey });
            if (!account) {
                logger.trace('getAccount exit - not found');
                return account;
            }
            if (shallowCopy) {
                logger.trace('getAccount exit');
                return account;
            } else {
                const stellAccount = yield _this4._mergeAccountFields(account, publicKey);

                logger.trace('getAccount exit');
                return stellAccount;
            }
        })();
    }

    getAccounts(user) {
        var _this5 = this;

        return _asyncToGenerator(function* () {
            logger.trace('getAccounts entry', user);
            const accounts = yield Account.find({ userId: user.id });
            let mergedAccounts = [];
            for (const account of accounts) {
                const stellAccount = yield _this5._mergeAccountFields(account, account.public_key);
                mergedAccounts.push(stellAccount);
            }
            logger.trace('getAccounts exit');
            return mergedAccounts;
        })();
    }

    checkAuthorized(user, publicKey) {
        return _asyncToGenerator(function* () {
            logger.trace('checkAuthorized entry', [user, publicKey]);
            let authorized = false;
            if (user && user.id && publicKey) {
                const account = yield Account.findOne({ userId: user.id, public_key: publicKey });
                if (account) {
                    authorized = true;
                }
            }
            logger.trace('checkAuthorized exit', authorized);
            return authorized;
        })();
    }

    createAsset(user, assetCode, assetIssuer, description) {
        return _asyncToGenerator(function* () {
            logger.trace('createAsset entry', user);
            const stellarAsset = yield _stellar.createAsset(assetCode, assetIssuer);
            logger.trace('checkAuthorized stellarAsset created', stellarAsset);
            const asset = new Asset({
                userId: user.id,
                tenantId: user.tenantId,
                email: user.email,
                asset_code: assetCode,
                asset_issuer: assetIssuer,
                description: description
            });
            const result = yield asset.save();
            logger.trace('createAsset exit', [asset, result]);
            return asset;
        })();
    }
    getAssets(user) {
        return _asyncToGenerator(function* () {
            logger.trace('getAssets entry', user);
            const assets = yield Asset.find({ tenantId: user.tenantId });
            logger.trace('getAssets exit', assets);
            return assets;
        })();
    }

    _mergeAccountFields(account, publicKey) {
        return _asyncToGenerator(function* () {
            logger.trace('_mergeAccountFields entry', [account, publicKey]);
            const stellAccount = yield _stellar.getAccountDetails(publicKey);
            _.forEach(account.toObject(), function (value, key) {
                if (key === '_id') {
                    _.set(stellAccount, 'id', value);
                } else {
                    _.set(stellAccount, key, value);
                }
            });
            logger.trace('_mergeAccountFields exit', [stellAccount]);
            return stellAccount;
        })();
    }

    getFee(type) {
        return _asyncToGenerator(function* () {
            logger.trace('getFee entry', [type]);
            const result = fees[type];
            logger.trace('getFee exit', [result]);
            return result;
        })();
    }

};
//# sourceMappingURL=Wallet.js.map