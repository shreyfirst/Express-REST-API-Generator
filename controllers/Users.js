"use strict";

var Users = require('../models').Users;
var Trash = require('../models').Trash;
var q = require('q');
var queue = require('../services/queue');
var debug = require('debug')('usersController');
var _ = require('lodash');

var service = 'Users';

var UsersController = {};

UsersController.buildProjection = function(projections){
    debug('starting build...');
    var projection = projections.split(','); // Projection should be comma separated. eg. name,location
    return q.Promise(function(resolve,reject,notify){
        debug('This is a promise...');
        var num = projection.length;
        var last = num - 1;
        var select = {};
        for(var n in projection){
            if(typeof projection[n] === 'string'){
                debug('Processing...', projection[n]);
                notify('Adding '+projection[n]+' to projection');
                select[projection[n]] = 1;
                if(n * 1 === last){
                    debug('Coming out of the loop...', select);
                    notify('Ending Build.');
                    return resolve(select);
                }
            }else{
                debug('Skiping...', projection[n]);
                if(n * 1 === last){
                    debug('Coming out of the loop......', select);
                    notify('Ending Build..');
                    return resolve(select);
                }
            }
        }
    });
};

UsersController.find = function(req,res,next){
    var query;
    
    if(req.query.search){
        query = req.query.search;
        // Clean appId and userId
        if(query && query.appId){
            delete query.appId;
        }
        if(query && query.accountId){
            delete query.accountId;
        }
        
        Users.search(query)
        .then(function(resp){
            res.ok(JSON.parse(JSON.stringify(resp)));
        })
        .catch(function(err){
            next(err);
        });
    }else{
        query = req.query;
        // Clean appId and userId
        if(query && query.appId){
            delete query.appId;
        }
        if(query && query.accountId){
            delete query.accountId;
        }
        var _query = {};
        var projection = query.select; // Projection should be comma separated. eg. name,location
        var ourProjection;
        
        if(projection){
            ourProjection = UsersController.buildProjection(projection);
            delete query.select;
        }
        var limit = query.limit * 1;
        if(limit){
            delete query.limit;
        }

        var from = query.from;
        var to = query.to;
        if(from){
            query.createdAt = {};
            query.createdAt.$gte = from;
            delete query.from;
            if(to){
                delete query.to;
            }else{
                to = new Date().toISOString();
            }
            query.createdAt.$lte = to;
        }else{
            query.createdAt = {};
            query.createdAt.$gte = new Date('1989-03-15T00:00:00').toISOString();
            if(to){
                delete query.to;
            }else{
                to = new Date().toISOString();
            }
            query.createdAt.$lte = to;
        }
        var lastId = query.lastId * 1;
        if(lastId){
            if(query.desc){
                query._id = {};
                query._id.$lt = lastId;
                delete query.desc;
            }else{
                query._id = {};
                query._id.$gt = lastId;
            }
            delete query.lastId;
        }
        if(query.desc){
            delete query.desc;
        }
        var sort = query.sort; // -fieldName: means descending while fieldName without the minus mean ascending bith by fieldName. eg, '-fieldName1 fieldName2'
        if(sort){
            delete query.sort;
        }
        var populate = query.populate; // Samples: 'name location' will populate name and location references. only supports this for now | 'name', 'firstname' will populate name reference and only pick the firstname attribute
        if(populate){
            delete query.populate;
        }
        var totalResultQ;
        var totalQ;
        var questionQ;

        if(limit){
            _query.limit = limit;
        }else{
            limit = 50;
            _query.limit = limit;
        }
        _query.where = query;
        var totalResult = Users.count(_query);
        var total = Users.count({});

        if(sort){
            _query.order = [];
            var splitSort = sort.split(' ');
            for(var n in splitSort){
                if(typeof splitSort[n] === 'string'){
                    if(splitSort[n][0] === '-'){
                        _query.order.push([splitSort[n].substr('1'), 'DESC']);
                    }else{
                        _query.order.push([splitSort[n], 'ASC']);
                    }
                }
            }
        }

        if (populate) {
            _query.include = [];
            var splitPopulation = populate.split(' ');
            for (var m in splitPopulation) {
                if (typeof splitPopulation[m] === 'string') {
                    if (models[splitPopulation[m]]) {
                        _query.include.push({ model: models[splitPopulation[m]] });
                    }
                }
            }
        }

        if(projection){
            q.all([ourProjection,total,totalResult])
            .spread(function(resp,total,totalResult){
                resp._id = 1;
                _query.attributes = _.keys(resp);
                return [Users.findAll(_query),total,totalResult];
            })
            .spread(function(resp,total,totalResult){
                var ourLastId;
                if(resp.length === 0){
                    ourLastId = null;
                }else{
                    ourLastId = resp[resp.length - 1]._id;
                }
                
                var extraData = {};
                extraData.limit = limit * 1;
                extraData.total = total;
                extraData.totalResult = totalResult;
                extraData.lastId = ourLastId;
                extraData.isLastPage = (totalResult < limit) ? true : false;
                res.ok(JSON.parse(JSON.stringify(resp)), false, extraData);
            })
            .catch(function(err){
                next(err);
            });
        }else{
            q.all([Users.findAll(_query),total,totalResult])
            .spread(function(resp,total,totalResult){
                var ourLastId;
                if(resp.length === 0){
                    ourLastId = null;
                }else{
                    ourLastId = resp[resp.length - 1]._id;
                }

                
                var extraData = {};
                extraData.limit = limit * 1;
                extraData.total = total;
                extraData.lastId = ourLastId;
                extraData.totalResult = totalResult;
                extraData.isLastPage = (totalResult < limit) ? true : false;
                res.ok(JSON.parse(JSON.stringify(resp)), false, extraData);
            })
            .catch(function(err){
                next(err);
            });
        }

    }
};

UsersController.findOne = function(req,res,next){  
    var _query = {};
    var id = req.params.id;
    var query = req.query;
    var populate;
    if(query){
        populate = query.populate; // Samples: 'name location' will populate name and location references. only supports this for now | 'name', 'firstname' will populate name reference and only pick the firstname attribute
    }
    _query.where = Users.where = {_id:id};

    if (populate) {
        delete query.populate;
        _query.include = [];
        var splitPopulation = populate.split(' ');
        for (var m in splitPopulation) {
            if (typeof splitPopulation[m] === 'string') {
                if (models[splitPopulation[m]]) {
                    _query.include.push({ model: models[splitPopulation[m]] });
                }
            }
        }
    }

    var question = Users.findOne(_query);

    question
    .then(function(resp){
        if(!resp){
            next();
        }else{
            res.ok(resp.toJSON());
        }
    })
    .catch(function(err){
        next(err);
    });
};

UsersController.create = function(req,res,next){
    var data  = req.body;
    if(data && data.secure){
        delete data.secure;
    }

    var question;
    if(data.length){
        question = Users.bulkCreate(data);
    }else{
        question = Users.create(data);
    }

    question
    .then(function(resp){
        res.ok(resp);
    })
    .catch(function(err){
        next(err);
    });
};

UsersController.update = function(req,res,next){
    var query = req.query;
    var _query = {};
    // Clean appId and userId
    if(query && query.appId){
        delete query.appId;
    }
    if(query && query.accountId){
        delete query.accountId;
    }
    var data  = req.body;
    if(data && data.secure){
        delete data.secure;
    }

    _query.where = query;
    Users.update(data, _query)
    .then(function(resp){
        res.ok(resp);
    })
    .catch(function(err){
        next(err);
    });
};

UsersController.updateOne = function(req,res,next){
    var _query = {};
    var id = req.params.id;
    var data  = req.body;
    if(data && data.secure){
        delete data.secure;
    }
    _query.where = Users.where = {_id:id};
    Users.update(data,_query)
    .then(function(resp){
        if(!resp){
            next();
        }else{
            res.ok(resp);
        }
    })
    .catch(function(err){
        next(err);
    });
};

UsersController.delete = function(req,res,next){ 
    var _query = {};
    var query = req.query;
    // Clean appId and userId
    if(query && query.appId){
        delete query.appId;
    }
    if(query && query.accountId){
        delete query.accountId;
    }

    _query.where = query;

    // Find match
    Users.findAll(_query)
    .then(function(resp){
        var num = resp.length;
        var last = num - 1;
        for(var n in resp){
            if(typeof resp === 'object'){
                // Backup data in Trash
                var backupData = {};
                backupData.service = service;
                backupData.data = resp[n];
                backupData.owner = req.accountId;
                backupData.deletedBy = req.accountId;
                backupData.client = req.appId;
                backupData.developer = req.developer;

                queue.create('saveToTrash', backupData)
                .save();
                resp[n].destroy();
                if(n * 1 === last){
                    return resp;
                }
            }else{
                if(n * 1 === last){
                    return resp;
                }
            }
        }
    })
    .then(function(resp){
        res.ok(resp);
    })
    .catch(function(err){
        next(err);
    });
};

UsersController.deleteOne = function(req,res,next){
    var _query = {};
    var id = req.params.id;

    _query.where = {_id:id};
    // Find match
    Users.findOne(_query)
    .then(function(resp){
        if(!resp){
            throw {statusCode: 404 , message: 'Could not find data'};
        }
        // Backup data in Trash
        var backupData = {};
        backupData.service = service;
        backupData.data = resp;
        backupData.owner = req.accountId;
        backupData.deletedBy = req.accountId;
        backupData.client = req.appId;
        backupData.developer = req.developer;

        queue.create('saveToTrash', backupData)
        .save();

        return resp.destroy();
    })
    .then(function(resp){
        res.ok(resp);
    })
    .catch(function(err){
        next(err);
    });
};

UsersController.restore = function(req,res,next){
    var id = req.params.id;
    // Find data by ID from trash 
    Trash.findById(id)
    .then(function(resp){
        // Restore to DB
        return Users.create(resp.data);
    })
    .then(function(resp){
        // Delete from trash
        return [Trash.findByIdAndRemove(id), resp];
    })
    .spread(function(trash, resp){
        res.ok(resp);
    })
    .catch(function(err){
        next(err);
    });
};

module.exports = UsersController;
