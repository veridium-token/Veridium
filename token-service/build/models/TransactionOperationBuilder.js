'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const StellarSDK = require('stellar-sdk');
const uuidv4 = require('uuid/v4');

const StellarNetwork = require('./StellarNetwork');
const _stellarNetwork = new StellarNetwork();

const Transaction = require('./Transaction');

const log4js = require('log4js');
const logger = log4js.getLogger('TransactionOperationBuilder');
logger.level = process.env.LOG_LEVEL || 'debug';

const i18n = require('i18n');
const path = require('path');
i18n.configure({
    directory: path.join(__dirname, '/../locales')
});

module.exports = class TransactionOperationBuilder {

    constructor(transactionSourceAccount, optionalDescription) {
        this._transactionSourceAccount = transactionSourceAccount;
        this._stellarTransactionBuilder = new StellarSDK.TransactionBuilder(transactionSourceAccount).setTimeout(200);
        this._pendingTransactionId = uuidv4();
        this._operations = [];
        this._optionalDescription = optionalDescription;
    }

    addOperation(operation) {
        var _this = this;

        return _asyncToGenerator(function* () {
            logger.trace('addOperationToTransactionBuilder entry');

            _this._operations.push(operation);
            yield _this._stellarTransactionBuilder.addOperation(operation);

            logger.trace('addOperationToTransactionBuilder exit');
            return _this;
        })();
    }

    addMemo(memo) {
        var _this2 = this;

        return _asyncToGenerator(function* () {
            _this2._stellarTransactionBuilder.addMemo(memo);
        })();
    }

    buildTransaction() {
        var _this3 = this;

        return _asyncToGenerator(function* () {
            let stellarTransaction = _this3._stellarTransactionBuilder.build();
            const transaction = yield _this3._persistNewTransaction(stellarTransaction);
            return transaction;
        })();
    }

    _determineThresholdOfOperation(operationFromXDR) {
        let thresholdCat = 'Medium';
        if (operationFromXDR.type === 'setOptions') {
            if (operationFromXDR.signer) {
                thresholdCat = 'High';
            } else if (operationFromXDR.masterWeight) {
                thresholdCat = 'High';
            } else if (operationFromXDR.lowThreshold) {
                thresholdCat = 'High';
            } else if (operationFromXDR.mediumThreshold) {
                thresholdCat = 'High';
            } else if (operationFromXDR.highThreshold) {
                thresholdCat = 'High';
            }
        } else if (operationFromXDR.type === 'accountMerge') {
            thresholdCat = 'High';
        } else if (operationFromXDR.type === 'bumpSequence') {
            thresholdCat = 'Low';
        } else if (operationFromXDR.type === 'allowTrust') {
            thresholdCat = 'Low';
        }

        return thresholdCat;
    }

    _persistNewTransaction(stellarTransaction) {
        var _this4 = this;

        return _asyncToGenerator(function* () {

            logger.trace('persistNewTransaction entry');
            const serializedXDR = stellarTransaction.toEnvelope().toXDR().toString('base64');
            const transaction = new Transaction({
                id: _this4._pendingTransactionId,
                source_acct: _this4._transactionSourceAccount.accountId(),
                xdr_representation: serializedXDR,
                submitted: false,
                hash: stellarTransaction.hash().toString('hex')
            });

            transaction._hasMediumThresholdOp = false;
            transaction._hasHighThresholdOp = false;
            transaction.operations = [];
            transaction.description = _this4._optionalDescription;

            _this4._transactionSourceAccount.signers.forEach(function (entry) {
                let signature = new Object();
                signature.public_key = entry.key;
                signature.signed = false;
                signature.weight = entry.weight;
                transaction.signatures.push(signature);
            });

            transaction.differentSourceOperationExists = false;

            for (let operation of _this4._operations) {
                const operationFromXDR = StellarSDK.Operation.fromXDRObject(operation);
                const operationSourceAccount = yield _stellarNetwork.loadAccount(operationFromXDR.source);

                let thresholdCat = _this4._determineThresholdOfOperation(operationFromXDR);
                if (thresholdCat === 'Medium') {
                    transaction._hasMediumThresholdOp = true;
                } else if (thresholdCat === 'High') {
                    transaction._hasHighThresholdOp = true;
                }

                let operationToPersist = new Object();
                operationToPersist.op_type = operationFromXDR.type;
                operationToPersist.threshold_category = thresholdCat;
                operationToPersist.source_acct = operationFromXDR.source;
                operationToPersist.signatures = [];

                if (_this4._transactionSourceAccount.accountId() === operationFromXDR.source) {
                    operationToPersist.sameSourceAccount = true;
                    operationToPersist.needs_signatures = false;
                } else {
                    transaction.differentSourceOperationExists = true;
                    operationToPersist.sameSourceAccount = false;
                    operationToPersist.needs_signatures = true;
                }

                operationSourceAccount.signers.forEach(function (entry) {
                    let signature = new Object();
                    signature.public_key = entry.key;
                    signature.signed = false;
                    signature.weight = entry.weight;
                    operationToPersist.signatures.push(signature);
                });

                transaction.operations.push(operationToPersist);
            }

            let maxThresholdCategory = 'Low';
            if (transaction._hasHighThresholdOp) {
                maxThresholdCategory = 'High';
            } else if (transaction._hasMediumThresholdOp) {
                maxThresholdCategory = 'Medium';
            }

            transaction.threshold_category = maxThresholdCategory;
            yield transaction.save();

            stellarTransaction = _this4._decorateStellarTransaction(stellarTransaction, transaction);
            logger.trace('persistNewTransaction exit', stellarTransaction.id);
            return stellarTransaction;
        })();
    }

    _decorateStellarTransaction(stellarTransaction, persistedTransaction) {
        return _asyncToGenerator(function* () {
            logger.trace('_decorateStellarTransaction entry', persistedTransaction.id);
            stellarTransaction.id = persistedTransaction.id;
            stellarTransaction.type = persistedTransaction.operations[0].op_type;
            stellarTransaction.source_acct = persistedTransaction.source_acct;
            stellarTransaction.xdr_representation = persistedTransaction.xdr_representation;
            stellarTransaction.description = persistedTransaction.description;
            stellarTransaction.submitted = persistedTransaction.submitted;
            stellarTransaction.error = persistedTransaction.error;
            stellarTransaction.signers = persistedTransaction.signatures;
            stellarTransaction.preAuthApprovers = persistedTransaction.approvers;
            stellarTransaction.createdAt = persistedTransaction.createdAt;
            stellarTransaction.hash = persistedTransaction.hash;
            stellarTransaction.operations = persistedTransaction.operations;
            logger.trace('_decorateStellarTransaction exit', persistedTransaction.id);
            return stellarTransaction;
        })();
    }
};
//# sourceMappingURL=TransactionOperationBuilder.js.map