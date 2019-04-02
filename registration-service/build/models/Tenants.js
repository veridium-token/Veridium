'use strict';

function _asyncToGenerator(fn) { return function () { var gen = fn.apply(this, arguments); return new Promise(function (resolve, reject) { function step(key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { return Promise.resolve(value).then(function (value) { step("next", value); }, function (err) { step("throw", err); }); } } return step("next"); }); }; }

const log4js = require('log4js');
const logger = log4js.getLogger('Tenants');
logger.level = process.env.LOG_LEVEL || 'debug';

const mongoose = require('mongoose');
require('../config/initializers/database');

const TenantSchema = new mongoose.Schema({
    name: {
        type: String,
        unique: true,
        min: [4, 'tenant name is too short'],
        required: [true, 'Missing required tenant name.']
    }
}, {
    read: 'nearest',
    usePushEach: true,
    timestamps: true
});

const Tenant = mongoose.model('Tenant', TenantSchema);

module.exports = class Tenants {

    constructor() {
        logger.trace('<init> entry');
        logger.trace('<init> exit');
    }
    createTenant(tenantToSignUp) {
        return _asyncToGenerator(function* () {
            logger.trace('createTenant entry', tenantToSignUp);
            const newTenant = yield new Tenant({ name: tenantToSignUp });
            const _tenant = yield newTenant.save();
            logger.trace('createTenant exit', _tenant);
            return _tenant;
        })();
    }
    findById(id) {
        return _asyncToGenerator(function* () {
            logger.trace('findById entry', id);
            const tenant = yield Tenant.findById(id);
            logger.trace('findById exit', tenant);
            return tenant;
        })();
    }
    findByName(name) {
        return _asyncToGenerator(function* () {
            logger.trace('findByName entry', name);
            const tenant = yield Tenant.findOne({ 'name': name });
            logger.trace('findByName exit', tenant);
            return tenant;
        })();
    }
    listTenants() {
        return _asyncToGenerator(function* () {
            logger.trace('listTenants entry');
            const allTenants = yield Tenant.find({});
            logger.trace('listTenants exit', allTenants);
            return allTenants;
        })();
    }
    deleteTenant(id) {
        return _asyncToGenerator(function* () {
            logger.trace('deleteTenant entry', id);
            const tenantToDelete = yield Tenant.findByIdAndDelete(id);
            logger.trace('deleteTenant exit', tenantToDelete);
            return tenantToDelete;
        })();
    }
};
//# sourceMappingURL=Tenants.js.map