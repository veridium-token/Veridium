'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const StellarSDK = require('stellar-sdk');
const rp = require('request-promise');
const log4js = require('log4js');
const logger = log4js.getLogger('StellarNetwork');
logger.level = process.env.LOG_LEVEL || 'debug';

let server;
if (process.env.STELLAR_NETWORK) {
    StellarSDK.Network.use(new StellarSDK.Network('Standalone Network ; February 2017'));
    server = new StellarSDK.Server(process.env.STELLAR_NETWORK, { allowHttp: true });
} else {
    //global stellar variable
    StellarSDK.Network.useTestNetwork();
    server = new StellarSDK.Server('https://horizon-testnet.stellar.org');
}
const _ = require('lodash');
const i18n = require('i18n');
const path = require('path');
i18n.configure({
    directory: path.join(__dirname, '/../locales')
});

module.exports = class StellarNetwork {

    bootstrapTestAccount() {
        return _asyncToGenerator(function* () {
            let keyPair = StellarSDK.Keypair.random();

            yield rp.get({
                //get initial token from testnet firendbot
                uri: 'https://horizon-testnet.stellar.org/friendbot',
                qs: { addr: keyPair.publicKey() },
                json: true
            });
            return keyPair;
        })();
    }

    loadAccount(publicKey) {
        return _asyncToGenerator(function* () {
            const loadedAccount = yield server.loadAccount(publicKey);
            return loadedAccount;
        })();
    }
    getAccountDetails(publicKey) {
        return _asyncToGenerator(function* () {
            logger.trace('getAccountDetails entry', publicKey);
            const account = yield server.loadAccount(publicKey);
            const filteredAccount = {
                thresholds: account.thresholds,
                balances: account.balances,
                signers: account.signers,
                home_domain: account.home_domain,
                flags: account.flags
            };
            _.forEach(account.signers, function (signer) {
                // make sure sometimes-missing public_key has always-present key value
                signer.public_key = signer.key;
                // match on passed in public key and check
                // if current signer is account owner
                if (publicKey === signer.public_key) {
                    filteredAccount.thresholds.master_weight = signer.weight;
                }
                signer.master = true;
            });

            logger.trace('getAccountDetails exit', filteredAccount);
            return filteredAccount;
        })();
    }

    /* Getting History */
    getHistory(publicKey, type) {
        return _asyncToGenerator(function* () {
            logger.trace('getHistory entry', publicKey);
            // const account = await server.loadAccount(publicKey);

            const historyPageSize = 50;
            let historyPage = yield server.transactions().forAccount(publicKey).limit(historyPageSize).call();
            let history = [];
            logger.trace('getHistory history size:', [historyPage.records.length]);

            let hasHistoryRecordsToDisplay = historyPage.records.length !== 0;
            while (hasHistoryRecordsToDisplay) {
                for (let i = 0; i < historyPage.records.length; i += 1) {
                    let transaction = historyPage.records[i];
                    const operationCount = transaction.operation_count;
                    let operations = yield transaction.operations({ limit: operationCount });
                    logger.trace('getHistory operations size:', [operationCount, operations.records.length]);
                    if (operations.records.length !== 0) {
                        let records = operations.records;
                        if (transaction.memo_type === 'text') {
                            records = _.map(records, function (o) {
                                return _.extend({ memo: transaction.memo }, o);
                            });
                        }
                        history = _.concat(history, records);
                    }
                }
                // check to see if we filled the page size limit (might mean more records)
                if (historyPage.records.length === historyPageSize) {
                    historyPage = yield historyPage.next();
                    hasHistoryRecordsToDisplay = historyPage.records.length !== 0;
                } else {
                    hasHistoryRecordsToDisplay = false;
                }
                logger.trace('getHistory hasHistoryRecordsToDisplay:', hasHistoryRecordsToDisplay);
            }
            if (type) {
                history = _.filter(history, { type: type });
            }
            logger.trace('getHistory exit', history);
            return history;
        })();
    }

    createAsset(assetCode, assetIssuer) {
        logger.trace('createAsset entry', [assetCode, assetIssuer]);
        const asset = new StellarSDK.Asset(assetCode, assetIssuer);
        logger.trace('createAsset exit', asset);
        return asset;
    }

    /* Get Account Balance */
    getBalances(publicKey) {
        return _asyncToGenerator(function* () {
            logger.trace('getBalances entry', publicKey);
            const account = yield server.loadAccount(publicKey);
            if (account.balances) {
                let returnValue = [];
                account.balances.forEach(function (entry) {
                    let item = {};
                    item.network = 'Stellar';
                    item.balance = entry.balance;
                    if (entry.asset_type === 'native') {
                        item.asset_code = 'XLM';
                    } else {
                        item.asset_code = entry.asset_code;
                        item.asset_issuer = entry.asset_issuer;
                    }
                    returnValue.push(item);
                });
                logger.trace('getBalances exit', returnValue);
                return returnValue;
            } else {
                logger.trace('getBalances exit', {});
                return {};
            }
        })();
    }

    /* Get Account Balance */
    getOffers(publicKey) {
        return _asyncToGenerator(function* () {
            logger.trace('getOffers entry', publicKey);
            const offers = yield server.offers('accounts', publicKey).call();
            logger.trace('getOffers exit', offers.records);
            return offers.records;
        })();
    }

    /* Get Orderbook*/
    getOrderbook(sell_asset_code, sell_asset_issuer, buy_asset_code, buy_asset_issuer) {
        var _this = this;

        return _asyncToGenerator(function* () {
            logger.trace('getOrderBook entry', [sell_asset_code, sell_asset_issuer, buy_asset_code, buy_asset_issuer]);
            let sellAsset;
            if (sell_asset_code.toUpperCase() === 'XLM') {
                sellAsset = new StellarSDK.Asset.native();
            } else {
                sellAsset = _this.createAsset(sell_asset_code, sell_asset_issuer);
            }
            let buyAsset;
            if (buy_asset_code.toUpperCase() === 'XLM') {
                buyAsset = new StellarSDK.Asset.native();
            } else {
                buyAsset = _this.createAsset(buy_asset_code, buy_asset_issuer);
            }
            const orders = yield server.orderbook(sellAsset, buyAsset).call();
            logger.trace('getOrderBook exit', orders);
            return orders;
        })();
    }

    /* Check TrustLine */
    checkTrustLine(publicKey, assetCode, assetIssuerAccount) {
        return _asyncToGenerator(function* () {
            if (assetCode.toUpperCase() === 'XLM') {
                return true;
            } //always trust native crypto

            logger.trace('checkTrustLine entry', [publicKey, assetCode, assetIssuerAccount]);

            let trusted = false;
            let account = yield server.loadAccount(publicKey);

            for (const balance of account.balances) {
                let balanceAssetCode = balance.asset_code;
                if (balanceAssetCode !== null && balanceAssetCode === assetCode) {
                    let balanceAssetIssuer = balance.asset_issuer;
                    if (balanceAssetIssuer !== null && balanceAssetIssuer === assetIssuerAccount) {
                        trusted = true;
                    }
                }
            }

            logger.trace('checkTrustLine exit', trusted);
            return trusted;
        })();
    }

    submitSerializedTransaction(serializedXDR) {
        var _this2 = this;

        return _asyncToGenerator(function* () {
            logger.trace('submitSerializedTransaction entry', [serializedXDR]);
            const rehydratedTransaction = new StellarSDK.Transaction(serializedXDR);
            let result;

            try {
                result = yield _this2._transaction(rehydratedTransaction);
            } catch (error) {
                logger.error('submitSerializedTransaction error before retry', error);
                result = yield _this2._transaction(rehydratedTransaction);
            }

            logger.trace('submitSerializedTransaction exit', [serializedXDR]);
            return result;
        })();
    }

    _transaction(payload) {
        return _asyncToGenerator(function* () {
            logger.trace('_transaction entry');
            const transactionResult = yield server.submitTransaction(payload);
            logger.trace('_transaction exit', [transactionResult.hash, transactionResult.ledger]);
            return transactionResult;
        })();
    }
};
//# sourceMappingURL=StellarNetwork.js.map