'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const chai = require('chai');
const assert = chai.assert;
const log4js = require('log4js');
const logger = log4js.getLogger('Users');
logger.level = process.env.LOG_LEVEL || 'debug';
const uuidv4 = require('uuid/v4');

// application dependencies..
const app = require('../../app');
const mongoose = require('mongoose');
require('../../config/initializers/database');

const request = require('supertest');
const tenantName = uuidv4();

describe('outer describe', function () {
    // Before test suite, let's create a tenant
    // then after we are done, we delete the tenant.
    var tenantId;
    var userId;
    var emailAddress;

    beforeAll((() => {
        var _ref = _asyncToGenerator(function* (done) {
            logger.info('create tenant');
            const res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': 'mutation { createTenant(name: "' + tenantName + '") {id name} }' });
            tenantId = JSON.parse(res.text)['data']['createTenant']['id'];
            logger.info('beforeAll tenantId', tenantId);
            done();
        });

        return function (_x) {
            return _ref.apply(this, arguments);
        };
    })());
    beforeAll((() => {
        var _ref2 = _asyncToGenerator(function* (done) {
            logger.info('List tenants');
            const res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': '{ listTenants { id name } } ' });
            const listOfTenants = JSON.parse(res.text)['data']['listTenants'];
            let found = false;
            listOfTenants.forEach(function (entry) {
                if (entry.id === tenantId) {
                    found = true;
                }
            });
            assert.isTrue(found, 'Failed to find tenant' + tenantId);
            done();
        });

        return function (_x2) {
            return _ref2.apply(this, arguments);
        };
    })());

    afterAll((() => {
        var _ref3 = _asyncToGenerator(function* (done) {
            logger.info('Delete tenant');
            const res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': 'mutation { deleteTenant(id:"' + tenantId + '"){ id name } }' });

            const deletedTenant = yield JSON.parse(res.text)['data']['deleteTenant'];
            assert.isNotNull(deletedTenant.id);
            logger.info('Deleted: ' + deletedTenant);

            logger.info('Closing mongoose connection');
            yield mongoose.connection.close();
            logger.info('After closing mongoose connection, marking done');
            done();
        });

        return function (_x3) {
            return _ref3.apply(this, arguments);
        };
    })());

    //  End beforeAll / afterAll section

    // Before each test, let's create a user
    // then after we are done, we delete the user.
    beforeEach((() => {
        var _ref4 = _asyncToGenerator(function* (done) {

            var oneInAMillion = Math.floor(Math.random() * 1000000 + 1);
            emailAddress = 'john' + oneInAMillion + '@example.com';
            logger.info('Sign up new user: ' + emailAddress);

            const res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': 'mutation { createUser (tenantId: "' + tenantId + '", email: "' + emailAddress + '", password: "password") { email id tenantId }   }' });
            const createdUser = yield JSON.parse(res.text)['data']['createUser'];
            userId = createdUser.id;
            logger.info('Created user with id ' + userId);
            assert.isNotNull(createdUser.id);
            assert.equal(createdUser.email, emailAddress);
            assert.equal(createdUser.tenantId, tenantId);
            done();
        });

        return function (_x4) {
            return _ref4.apply(this, arguments);
        };
    })());
    afterEach((() => {
        var _ref5 = _asyncToGenerator(function* (done) {
            logger.info('Delete user by id ' + userId);
            yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': 'mutation { deleteUser ( id: "' + userId + '") { id } }' });
            done();
        });

        return function (_x5) {
            return _ref5.apply(this, arguments);
        };
    })());
    //  End before each / after each section

    describe('Create tenant -- fail (empty tenant name)', () => {
        it('Create tenant -- fail', (() => {
            var _ref6 = _asyncToGenerator(function* (done) {
                logger.info('create tenant');
                const res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': 'mutation { createTenant(name: "' + '") {id name} }' });
                const createdTenant = yield JSON.parse(res.text)['data']['createTenant'];
                assert.isNull(createdTenant);
                const result = JSON.parse(res.text)['errors'][0]['message'];
                const expectedResult = 'Tenant validation failed: name: Missing required tenant name.';
                assert.isNotNull(result);
                assert.equal(result, expectedResult);
                done();
            });

            return function (_x6) {
                return _ref6.apply(this, arguments);
            };
        })());
    });

    describe('Create user -- fail (empty email id)', () => {
        it('Create user -- fail', (() => {
            var _ref7 = _asyncToGenerator(function* (done) {
                var oneInAMillion = Math.floor(Math.random() * 1000000 + 1);
                emailAddress = 'john' + oneInAMillion + '@example.com';
                logger.info('Sign up new user: ' + emailAddress);

                const res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': 'mutation { createUser (tenantId: "' + tenantId + '", email: "' + '", password: "password") { email id tenantId }   }' });
                const createdUser = yield JSON.parse(res.text)['data']['createUser'];
                assert.isNull(createdUser);
                const result = JSON.parse(res.text)['errors'][0]['message'];
                const expectedResult = 'User validation failed: email: Missing required email address.';
                assert.isNotNull(result);
                assert.equal(result, expectedResult);
                done();
            });

            return function (_x7) {
                return _ref7.apply(this, arguments);
            };
        })());
    });

    describe('Create user -- fail (empty tenant id)', () => {
        it('Create user -- fail', (() => {
            var _ref8 = _asyncToGenerator(function* (done) {
                var oneInAMillion = Math.floor(Math.random() * 1000000 + 1);
                emailAddress = 'john' + oneInAMillion + '@example.com';
                logger.info('Sign up new user: ' + emailAddress);

                const res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': 'mutation { createUser (tenantId: "' + '", email: "' + emailAddress + '", password: "password") { email id tenantId }   }' });
                const createdUser = yield JSON.parse(res.text)['data']['createUser'];
                assert.isNull(createdUser);
                const result = JSON.parse(res.text)['errors'][0]['message'];
                const expectedResult = 'User validation failed: tenantId: Missing required tenant id.';
                assert.isNotNull(result);
                assert.equal(result, expectedResult);
                done();
            });

            return function (_x8) {
                return _ref8.apply(this, arguments);
            };
        })());
    });

    describe('Logging in user', () => {
        it('Login User', (() => {
            var _ref9 = _asyncToGenerator(function* (done) {
                logger.info('Login user');
                let res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': ' mutation { login(email: "' + emailAddress + '", password: "password") {authToken}  }' });
                JSON.parse(res.text)['data']['login'];
                assert.isNotNull(JSON.parse(res.text)['data']['login']);
                done();
            });

            return function (_x9) {
                return _ref9.apply(this, arguments);
            };
        })());
    });

    describe('Logging in user', () => {
        var bearerToken;
        it('Login User', (() => {
            var _ref10 = _asyncToGenerator(function* (done) {
                logger.info('Login user');
                let res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': ' mutation { login(email: "' + emailAddress + '", password: "password") {authToken} }' });
                bearerToken = JSON.parse(res.text)['data']['login']['authToken'];
                assert.isNotNull(JSON.parse(res.text)['data']['login']['authToken']);

                logger.info('Get logged in user info');
                res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').set('Authorization', 'Bearer ' + bearerToken).send({ 'query': ' {me { email      }    }' });
                assert.isNotNull(JSON.parse(res.text)['data']['me']);
                done();
            });

            return function (_x10) {
                return _ref10.apply(this, arguments);
            };
        })());
    });

    describe('List users', () => {
        var bearerToken;
        it('List Users', (() => {
            var _ref11 = _asyncToGenerator(function* (done) {
                logger.info('Login user');
                let res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': ' mutation { login(email: "' + emailAddress + '", password: "password") {authToken} }' });
                bearerToken = JSON.parse(res.text)['data']['login']['authToken'];
                assert.isNotNull(JSON.parse(res.text)['data']['login']['authToken']);

                logger.info('Get list of users');
                res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').set('Authorization', 'Bearer ' + bearerToken).send({ 'query': ' {listUsers { email      }    }' });
                assert.isNotNull(JSON.parse(res.text)['data']['listUsers']);
                assert.equal(JSON.parse(res.text)['data']['listUsers'].length, 1, 'list of users count');
                done();
            });

            return function (_x11) {
                return _ref11.apply(this, arguments);
            };
        })());
    });

    describe('Looking myself up -- fail (no bearer)', () => {
        it('me', (() => {
            var _ref12 = _asyncToGenerator(function* (done) {
                logger.info('Looking myself up -- fail (no bearer)');
                let res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': ' {me {  email      }    }' });
                assert.isNull(JSON.parse(res.text)['data']['me']);
                assert.isNotNull(JSON.parse(res.text)['errors'][0]['message']);
                done();
            });

            return function (_x12) {
                return _ref12.apply(this, arguments);
            };
        })());
    });

    describe('Logging in user -- fail (incorrect password)', () => {
        it('Login User', (() => {
            var _ref13 = _asyncToGenerator(function* (done) {
                logger.info('Logging in user -- fail (incorrect password)');
                let res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': ' mutation { login(email: "' + emailAddress + '", password: "NOT_ACTUAL_PASSWORD") {authToken} } ' });
                assert.isNull(JSON.parse(res.text)['data']['login']);
                const result = JSON.parse(res.text)['errors'][0]['message'];
                const expectedResult = 'Incorrect password';
                assert.isNotNull(result);
                assert.equal(result, expectedResult);
                done();
            });

            return function (_x13) {
                return _ref13.apply(this, arguments);
            };
        })());
    });

    describe('Logging in user -- fail (too many attempts lock account)', () => {
        it('Login User', (() => {
            var _ref14 = _asyncToGenerator(function* (done) {
                let loginFailure = (() => {
                    var _ref15 = _asyncToGenerator(function* (count, tooManyLoginsCheck) {
                        logger.info('Enter loginFailure', [count, tooManyLoginsCheck]);
                        const res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': ' mutation { login(email: "' + emailAddress + '", password: "NOT_ACTUAL_PASSWORD") {authToken}  }' });
                        assert.isNull(JSON.parse(res.text)['data']['login']);
                        if (tooManyLoginsCheck) {
                            const result = JSON.parse(res.text)['errors'][0]['message'];
                            const expectedResult = 'Too many failed login attempts';
                            assert.isNotNull(result);
                            assert.equal(result, expectedResult);
                        } else {
                            assert.isNull(JSON.parse(res.text)['data']['login']);
                            const result = JSON.parse(res.text)['errors'][0]['message'];
                            const expectedResult = 'Incorrect password';
                            assert.isNotNull(result);
                            assert.equal(result, expectedResult);
                        }
                        logger.info('Exit loginFailure', [count, tooManyLoginsCheck]);
                    });

                    return function loginFailure(_x15, _x16) {
                        return _ref15.apply(this, arguments);
                    };
                })();

                logger.info('Logging in user -- fail (too many attempts lock account)');
                yield loginFailure(1); // failure 1
                yield loginFailure(2); // failure 2
                yield loginFailure(3); // failure 3
                yield loginFailure(4); // failure 4
                yield loginFailure(5); // failure 5
                yield loginFailure(6, true); // failure 6 -- account locked
                done();
            });

            return function (_x14) {
                return _ref14.apply(this, arguments);
            };
        })());
    });

    describe('Reset password for user', () => {
        it('Reset password', (() => {
            var _ref16 = _asyncToGenerator(function* (done) {
                logger.info('Reset password');
                let res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': 'mutation { resetPassword(email: "' + emailAddress + '") {id email} }' });
                assert.isNotNull(JSON.parse(res.text)['data']['resetPassword']);
                assert.notExists(JSON.parse(res.text)['errors']);
                done();
            });

            return function (_x17) {
                return _ref16.apply(this, arguments);
            };
        })());
    });

    describe('Change password', () => {
        var bearerToken;
        it('Login User', (() => {
            var _ref17 = _asyncToGenerator(function* (done) {
                logger.info('Change password');
                let res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': ' mutation { login(email: "' + emailAddress + '", password: "password") {authToken} }' });
                bearerToken = JSON.parse(res.text)['data']['login']['authToken'];
                assert.isNotNull(JSON.parse(res.text)['data']['login']['authToken']);
                done();
            });

            return function (_x18) {
                return _ref17.apply(this, arguments);
            };
        })());
        it('Change password: pass', (() => {
            var _ref18 = _asyncToGenerator(function* (done) {
                logger.info('Change password - pass');
                let res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').set('Authorization', 'Bearer ' + bearerToken).send({ 'query': 'mutation { changePassword (email: "' + emailAddress + '", currentpassword: "password", newpassword: "password1") {email tenantId}   }' });
                const result = JSON.parse(res.text)['errors'];
                assert.notExists(result);
                assert.isNotNull(JSON.parse(res.text)['data']['changePassword']);
                // verify login works with new password
                res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': ' mutation { login(email: "' + emailAddress + '", password: "password1") {authToken} }' });
                bearerToken = JSON.parse(res.text)['data']['login']['authToken'];
                assert.isNotNull(JSON.parse(res.text)['data']['login']['authToken']);
                done();
            });

            return function (_x19) {
                return _ref18.apply(this, arguments);
            };
        })());
    });
    describe('Change password -- fail', () => {
        var bearerToken;
        it('Login User', (() => {
            var _ref19 = _asyncToGenerator(function* (done) {
                logger.info('Change password - fail');
                let res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').send({ 'query': ' mutation { login(email: "' + emailAddress + '", password: "password") {authToken}}' });
                bearerToken = JSON.parse(res.text)['data']['login']['authToken'];
                assert.isNotNull(JSON.parse(res.text)['data']['login']['authToken']);
                done();
            });

            return function (_x20) {
                return _ref19.apply(this, arguments);
            };
        })());
        it('Change password: invalid password', (() => {
            var _ref20 = _asyncToGenerator(function* (done) {
                logger.info('Change password - invalid');
                let res = yield request(app).post('/registration').set('Accept', 'application/json').set('Content-Type', 'application/json').set('Authorization', 'Bearer ' + bearerToken).send({ 'query': 'mutation { changePassword (email: "' + emailAddress + '", currentpassword: "NOT_ACTUAL_PASSWORD", newpassword: "password1")  {id email}  }' });
                assert.isNull(JSON.parse(res.text)['data']['changePassword']);
                const result = JSON.parse(res.text)['errors'][0]['message'];
                const expectedResult = 'Incorrect password';
                assert.isNotNull(result);
                assert.equal(result, expectedResult);
                done();
            });

            return function (_x21) {
                return _ref20.apply(this, arguments);
            };
        })());
    });
});
//# sourceMappingURL=index.test.js.map