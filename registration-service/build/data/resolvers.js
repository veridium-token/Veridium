'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

// data/resolvers.js

const Users = require('../models/Users.js');
const _users = new Users();

const Tenants = require('../models/Tenants.js');
const _tenants = new Tenants();

const bcrypt = require('bcrypt');
const jsonwebtoken = require('jsonwebtoken');

const log4js = require('log4js');
const logger = log4js.getLogger('resolvers');
logger.level = process.env.LOG_LEVEL || 'debug';

const mongoose = require('mongoose');
require('../config/initializers/database');

const i18n = require('i18n');
const path = require('path');
i18n.configure({
    directory: path.join(__dirname, '/../locales')
});

const { AuthenticationError, ApolloError } = require('apollo-server');

class AuthToken {
    constructor(authToken) {
        this.authToken = authToken;
    }
}

const resolvers = {
    Query: {
        // fetch the profile of currently authenticated user
        me(_, args, { user }) {
            return _asyncToGenerator(function* () {
                logger.trace('me entry', user);
                // make sure user is logged in
                if (!user) {
                    throw new Error('You are not authenticated!');
                }
                // user is authenticated
                const whoAmI = yield _users.findById(user.id);
                logger.trace('me exit', whoAmI);
                return whoAmI;
            })();
        },
        listTenants(_, args, {}) {
            return _asyncToGenerator(function* () {
                // return all tenants
                logger.trace('listTenants entry');
                const tenants = yield _tenants.listTenants();
                logger.trace('listTenants exit', tenants);
                return tenants;
            })();
        },
        listUsers(_, args, { user }) {
            return _asyncToGenerator(function* () {
                // return all users
                logger.trace('listUsers entry');
                const users = yield _users.listUsers(user.tenantId);
                logger.trace('listUsers exit', users);
                return users;
            })();
        }
    },
    Mutation: {
        // Handle user signup
        createUser(_, { tenantId, email, password }) {
            return _asyncToGenerator(function* () {
                logger.trace('createUser entry', { tenantId, email });
                const existingUser = yield _users.findByEmail(email);
                if (existingUser) {
                    throw new ApolloError(i18n.__('duplicate.user.fail'));
                }
                const user = yield _users.createUser({
                    tenantId,
                    email,
                    password: yield bcrypt.hash(password, 10)
                });
                if (!user) {
                    throw new Error(i18n.__('create.user.fail'));
                }
                logger.trace('createUser exit', user);
                // return newly created user
                return user;
            })();
        },
        deleteUser(_, { id }) {
            return _asyncToGenerator(function* () {
                logger.trace('deleteUser entry', id);
                const deletedUser = yield _users.deleteUser(id);
                if (!deletedUser) {
                    throw new AuthenticationError(i18n.__('no.user.id'));
                }
                logger.trace('deleteUser exit', deletedUser);
                return deletedUser;
            })();
        },
        // Handles user login
        login(_, { email, password }) {
            return _asyncToGenerator(function* () {
                logger.trace('login entry', email);
                let user = yield _users.findByEmail(email);
                logger.trace('login user', user);
                if (!user) {
                    throw new AuthenticationError(i18n.__('no.user.email'));
                }

                const valid = yield bcrypt.compare(password, user._password);
                if (!valid) {
                    // update failed login count
                    user = yield _users.incrementFailedLogin(email);
                    logger.error('incrementFailedLogin user', user);
                    if (user.accountLocked) {
                        throw new AuthenticationError(i18n.__('too.many.login.attempts'));
                    } else {
                        throw new AuthenticationError(i18n.__('incorrect.password'));
                    }
                } else {
                    yield _users.resetLoginFailure(email);
                }
                // return json web token
                const authToken = new AuthToken(jsonwebtoken.sign({
                    tenantId: user.tenantId,
                    id: user.id,
                    email: user.email
                }, process.env.JWT_SECRET, { expiresIn: '1d' }));
                logger.trace('login authToken', authToken);

                return authToken;
            })();
        },
        resetPassword(_, { email }) {
            return _asyncToGenerator(function* () {
                logger.trace('resetPassword entry', email);
                let user = yield _users.findByEmail(email);
                if (!user) {
                    throw new AuthenticationError(i18n.__('no.user.email'));
                }
                yield _users.resetPassword(email);
                logger.trace('resetPassword exit', user);
                return user;
            })();
        },
        // Handles change password
        changePassword(_, { email, currentpassword, newpassword }) {
            return _asyncToGenerator(function* () {
                logger.trace('changePassword entry', email);
                var user = yield _users.findByEmail(email);
                if (!user) {
                    throw new AuthenticationError(i18n.__('no.user.email'));
                }
                const valid = yield bcrypt.compare(currentpassword, user._password);
                if (!valid) {
                    throw new AuthenticationError(i18n.__('incorrect.password'));
                }
                var newEncryptedPassword = yield bcrypt.hash(newpassword, 10);
                user = yield _users.changePassword(email, newEncryptedPassword);
                logger.trace('changePassword exit', user.toJSON());
                return user;
            })();
        },
        createTenant(_, { name }) {
            return _asyncToGenerator(function* () {
                logger.trace('createTenant entry', name);
                var existingTenant = yield _tenants.findByName(name);
                if (existingTenant) {
                    logger.error('createTenant existing tenant throwing error', existingTenant);
                    throw new ApolloError(i18n.__('duplicate.tenant.fail'));
                }
                const tenantCreated = yield _tenants.createTenant(name);
                if (!tenantCreated) {
                    throw new ApolloError(i18n.__('no.tenant.fail'), 'CREATE_FAIL', {});
                }
                logger.trace('createTenant exit', tenantCreated);
                return tenantCreated;
            })();
        },
        deleteTenant(_, { id }) {
            return _asyncToGenerator(function* () {
                logger.trace('deleteTenant entry', id);
                const deletedTenant = yield _tenants.deleteTenant(id);
                if (!deletedTenant) {
                    throw new ApolloError(i18n.__('no.tenant.fail'), 'DELETE_FAIL', {});
                }
                logger.trace('deleteTenant exit', deletedTenant);
                return deletedTenant;
            })();
        }
    }
};

const mongoInitializeDB = function () {
    logger.trace('Resolvers init entry');
    mongoose.connection.once('open', function () {
        logger.trace('Mongo DB is opened');
    });
    mongoose.connection.on('connected', _asyncToGenerator(function* () {
        logger.trace('Mongo DB is connected');
        const tenantName = 'Project Lion';
        const email = 'lion@projectlion.com';
        const password = 'lion';
        var tenant = yield _tenants.findByName(tenantName);
        if (!tenant) {
            tenant = yield _tenants.createTenant(tenantName);
        }
        logger.trace('Default tenant', tenant);
        const tenantId = tenant.id;
        var user = yield _users.findByEmail(email);
        if (!user) {
            user = yield _users.createUser({
                tenantId, email,
                password: yield bcrypt.hash(password, 10)
            });
        }
        logger.trace('Default user', user);
    }));
};

module.exports.resolvers = resolvers;
module.exports.init = mongoInitializeDB;
//# sourceMappingURL=resolvers.js.map