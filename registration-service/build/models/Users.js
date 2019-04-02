'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const uuidv4 = require('uuid/v4');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const log4js = require('log4js');
const logger = log4js.getLogger('Users');
logger.level = process.env.LOG_LEVEL || 'debug';

const i18n = require('i18n');
const path = require('path');
i18n.configure({
    directory: path.join(__dirname, '/../locales')
});

const mongoose = require('mongoose');
require('../config/initializers/database');

var transporter;

nodemailer.createTestAccount((err, account) => {
    if (err) {
        throw new Error(err);
    }
    transporter = nodemailer.createTransport({
        debug: true,
        host: 'smtp.sendgrid.net',
        port: 465,
        secure: true, // use TLS
        auth: {
            user: 'apikey',
            pass: '<redacted>'
        }
    });
});

const UserSchema = new mongoose.Schema({
    tenantId: {
        type: String,
        unique: true,
        min: [4, 'tenant id is too short'],
        required: [true, 'Missing required tenant id.']
    },
    email: {
        type: String,
        unique: true,
        min: [4, 'email address is too short'],
        required: [true, 'Missing required email address.']
    },
    _password: {
        type: String,
        unique: true,
        min: [4, 'password is too short'],
        required: [true, 'Missing required password.']
    },
    failedLogins: Number,
    accountLocked: Boolean
}, {
    read: 'nearest',
    usePushEach: true,
    timestamps: true
});

const User = mongoose.model('User', UserSchema);

module.exports = class Users {
    constructor() {
        logger.trace('<init> entry');
        logger.trace('<init> exit');
    }
    createUser(userToSignUp) {
        return _asyncToGenerator(function* () {
            logger.trace('createUser entry');
            logger.trace('userToSignUp - tenantId:' + userToSignUp.tenantId);
            const user = yield new User({ tenantId: userToSignUp.tenantId, email: userToSignUp.email, _password: userToSignUp.password, _tempPassword: null, failedLogins: 0, accountLocked: false });
            yield user.save();
            logger.trace('<createUser> exit', user);
            return user;
        })();
    }
    deleteUser(id) {
        return _asyncToGenerator(function* () {
            logger.trace('deleteUser entry');
            const userToDelete = yield User.findByIdAndDelete(id);
            logger.trace('deleteUser exit', userToDelete);
            return userToDelete;
        })();
    }
    findById(id) {
        return _asyncToGenerator(function* () {
            logger.trace('findById entry', id);
            const user = yield User.findById(id);
            logger.trace('findById exit', user);
            return user;
        })();
    }
    findByEmail(email) {
        return _asyncToGenerator(function* () {
            logger.trace('findByEmail entry', email);
            const user = yield User.findOne({ 'email': email });
            logger.trace('findByEmail exit', user);
            return user;
        })();
    }
    listUsers(tenantId) {
        return _asyncToGenerator(function* () {
            logger.trace('listUsers entry');
            const allUsers = yield User.find({ 'tenantId': tenantId });
            logger.trace('listUsers exit', allUsers);
            return allUsers;
        })();
    }

    changePassword(email, newPassword) {
        var _this = this;

        return _asyncToGenerator(function* () {
            logger.trace('changePassword entry', email);
            let user = yield _this.findByEmail(email);
            if (user) {
                user._password = newPassword;
                yield user.save();
                user.save(function (err, returnedUser) {
                    if (err) {
                        logger.error('error in changePassword save', err);
                    } else {
                        user = returnedUser;
                    }
                });
            }
            logger.trace('changePassword exit', user);
            return user;
        })();
    }

    incrementFailedLogin(email) {
        var _this2 = this;

        return _asyncToGenerator(function* () {
            logger.trace('incrementFailedLogin entry', email);
            let user = yield _this2.findByEmail(email);
            if (user) {
                ++user.failedLogins;
                if (user.failedLogins > 5) {
                    user.accountLocked = true;
                }
                user = yield user.save();
            }
            logger.trace('incrementFailedLogin exit', user);
            return user;
        })();
    }

    resetLoginFailure(email) {
        var _this3 = this;

        return _asyncToGenerator(function* () {
            logger.trace('resetLoginFailure entry', email);
            const user = yield _this3.findByEmail(email);
            if (user) {
                user.failedLogins = 0;
                user.accountLocked = false;
                yield user.save();
            }
            logger.trace('resetLoginFailure exit', user);
        })();
    }
    resetPassword(email) {
        var _this4 = this;

        return _asyncToGenerator(function* () {
            logger.trace('resetPassword entry', email);
            const user = yield _this4.findByEmail(email);
            const tmpPassword = uuidv4();
            user.password = yield bcrypt.hash(tmpPassword, 10);
            yield user.save();
            let mailOptions = {
                from: '"Blockchain Token Factory" <donotreply@ibm.com>', // sender address
                to: email,
                subject: 'Password reset request for Blockchain Token Factory user ' + email, // Subject line
                text: 'Temporary password: ' + tmpPassword
                // text: 'Hello world?', // plain text body
                // html: '<b>Hello world?</b>' // html body
            };

            // send mail with defined transport object
            transporter.sendMail(mailOptions, function (error, info) {
                if (error) {
                    logger.error(i18n.__('failed.email.send'), error);
                    throw new Error(i18n.__('failed.email.send'));
                }
            });
            logger.trace('resetPassword exit', user);
            return user;
        })();
    }
};
//# sourceMappingURL=Users.js.map