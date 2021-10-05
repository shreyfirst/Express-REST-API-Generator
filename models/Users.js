"use strict";

var db = require('../services/database').sql;
var queue = require('../services/queue');

var table = 'Users';
var debug = require('debug')(table);

// Define schema
var schemaObject = {
    // ++++++++++++++ Modify to your own schema ++++++++++++++++++
    name: {
        type: db._sequelize.STRING
    },
    someOtherStringData: {
        type: db._sequelize.STRING
    },
    toPop: {
        type: db._sequelize.INTEGER
    }
    // ++++++++++++++ Modify to your own schema ++++++++++++++++++
};


schemaObject.owner = {
    type: db._sequelize.STRING
};

schemaObject.createdBy = {
    type: db._sequelize.STRING
};

schemaObject.client = {
    type: db._sequelize.STRING
};

schemaObject.developer = {
    type: db._sequelize.STRING
};

schemaObject.tags = {
    type: db._sequelize.STRING
};

schemaObject._id = {
    type: db._sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
};


// Define the table
var Users = db.define(table, schemaObject, {
    // Don't really delete data
    // paranoid: true,
    // define indexes here
    indexes:[{
        fields:['tags']
    },
    {
        unique: true,
        fields:['_id']
    }]
});

Users.associate = function (models) {
    // models.Users.belongsTo(models.toPop, { foreignKey: 'toPop', sourceKey: '_id' });
};

// Users.hasMany(Users, {foreignKey: 'toPop', sourceKey: '_id'});

// Adding hooks
Users.afterCreate(function(user, options) {
    // Indexing for search
    var ourDoc = user.dataValues;
    ourDoc.isSQL = true;
    ourDoc.model = table;

    // Dump it in the queue
    queue.create('searchIndex', ourDoc)
    .save();
});

Users.search = function(string){
    return Users.findAll({
        where: {
            tags: {
                $like: '%'+string
            }
        }
    });
};

Users.sync();

Users.transaction = db.transaction;

module.exports = Users;
// ToDo: Test transactions
