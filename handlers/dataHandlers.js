const DISABLE_SEC = (process.env.DISABLE_SEC === 'true') || false;
const mongoDB = require("../service/database");
const {transformIdToObjectId} = require("../service/database/util");
const fs = require('fs');
const path = require('path');
const mime = require('mime');
const nodemailer = require('nodemailer');
var General = {};
General.find = function(db, collection) {
  return function(req, res, next) {
    var query = req.query;
    mongoDB.find(db, collection, query).then((x) => {
      req.data = x;
      next();
    }).catch((e) => next(e));
  };
};

General.get = function(db, collection) {
  return function(req, res, next) {
    var query = req.query;
    delete query.token;
    mongoDB.find(db, collection, {_id: req.query.id}).then((x) => {
      req.data = x;
      next();
    }).catch((e) => next(e));
  };
};

General.distinct = function(db, collection, upon) {
  return function(req, res, next) {
    var query = req.query;
    delete query.token;
    mongoDB.distinct(db, collection, upon, query).then((x) => {
      req.data = x;
      next();
    }).catch((e) => next(e));
  };
};

General.add = function(db, collection) {
  return function(req, res, next) {
    const newData = JSON.parse(req.body);
    newData.create_date = new Date();
    mongoDB.add(db, collection, newData).then((x) => {
      req.data = x;
      next();
    }).catch((e) => next(e));
  };
};

General.update = function(db, collection) {
  return function(req, res, next) {
    var query = req.query;
    delete query.token;
    const updateData = JSON.parse(req.body);
    updateData.update_date = new Date();
    var newVals = {
      $set: updateData,
    };
    mongoDB.update(db, collection, query, newVals).then((x) => {
      req.data = x;
      next();
    }).catch((e) => next(e));
  };
};

General.delete = function(db, collection) {
  return function(req, res, next) {
    var query = req.query;
    delete query.token;
    mongoDB.delete(db, collection, query).then((x) => {
      req.data = x;
      next();
    }).catch((e) => next(e));
  };
};
var Labeling = {};
Labeling.pullAnnotation = function(req, res, next) {
  var query = req.query;
  delete query.token;
  const {labelId, annotationId} = query;
  mongoDB.update('camic', 'labeling', {'id': labelId}, {$pull: {annotations: annotationId}}).then((x) => {
    req.data = x;
    next();
  }).catch((e) => next(e));
};
Labeling.pushAnnotation = function(req, res, next) {
  var query = req.query;
  delete query.token;
  const {labelId, annotationId} = query;
  mongoDB.update('camic', 'labeling', {'id': labelId}, {$push: {annotations: annotationId}}).then((x) => {
    req.data = x;
    next();
  }).catch((e) => next(e));
};
var Presetlabels = {};
// add a label
Presetlabels.add = function(req, res, next) {
  var query = req.query;
  delete query.token;
  var labels = JSON.parse(req.body);
  mongoDB.update('camic', 'configuration', {'config_name': 'preset_label'}, {$push: {configuration: labels}}).then((x) => {
    req.data = x;
    next();
  }).catch((e) => next(e));
};

// update a label
Presetlabels.update = function(req, res, next) {
  var query = req.query;
  delete query.token;
  var labels = JSON.parse(req.body);

  // initial data
  var newVals = {
    $set: {
      'configuration.$.id': labels.id,
      'configuration.$.type': labels.type,
      'configuration.$.mode': labels.mode,
      'configuration.$.color': labels.color,
    },
  };

  // $unset/$set size
  if (labels.size) {
    newVals['$set']['configuration.$.size'] = labels.size;
  } else {
    if (!newVals['$unset']) newVals['$unset'] = {};
    newVals['$unset']['configuration.$.size'] = 1;
  }

  // $unset/$set key
  if (labels.key) {
    newVals['$set']['configuration.$.key'] = labels.key;
  } else {
    if (!newVals['$unset']) newVals['$unset'] = {};
    newVals['$unset']['configuration.$.key'] = 1;
  }

  mongoDB.update('camic', 'configuration',
      {
        'config_name': 'preset_label',
        'configuration.id': query.id,
      }, newVals).then((x) => {
    req.data = x;
    next();
  }).catch((e) => next(e));
};

// remove a label by key
Presetlabels.remove = function(req, res, next) {
  var query = req.query;
  delete query.token;
  mongoDB.update('camic', 'configuration',
      {
        'config_name': 'preset_label',
      }, {$pull: {configuration: {id: query.id}}}).then((x) => {
    req.data = x;
    next();
  }).catch((e) => next(e));
};

var Mark = {};
// special routes
Mark.spatial = function(req, res, next) {
  var query = req.query;
  delete query.token;
  // handle  x0, y0, x1, y1, footprint
  if (req.query.x0 && req.query.x1) {
    query.x = {
      '$gt': parseFloat(req.query.x0),
      '$lt': parseFloat(req.query.x1),
    };
  }
  delete query.x0;
  delete query.x1;
  if (req.query.y0 && req.query.y1) {
    query.y = {
      '$gt': parseFloat(req.query.y0),
      '$lt': parseFloat(req.query.y1),
    };
  }
  delete query.y0;
  delete query.y1;
  if (query.footprint) {
    query.footprint = {
      '$gt': parseFloat(query.footprint),
    };
  }
  mongoDB.find('camic', 'mark', query).then((x) => {
    req.data = x;
    next();
  }).catch((e) => next(e));
};

Mark.multi = function(req, res, next) {
  var query = {};

  var postQuery = JSON.parse(req.body);
  // handle slideId
  if (postQuery['provenance.image.slide']) {
    query['provenance.image.slide'] = postQuery['provenance.image.slide'];
  }
  // handle source
  if (postQuery.source) {
    query['provenance.analysis.source'] = postQuery.source;
  }

  // handle notes
  if (postQuery.notes) {
    query['properties.annotations.notes'] = postQuery.notes;
  }

  if (postQuery.ids) {
    query['provenance.analysis.execution_id'] = {'$in': postQuery.ids};
  }

  // handle  x0, y0, x1, y1, footprint
  if (postQuery.x0 && postQuery.x1) {
    query.x = {
      '$gt': parseFloat(postQuery.x0),
      '$lt': parseFloat(postQuery.x1),
    };
  }

  if (postQuery.y0 && postQuery.y1) {
    query.y = {
      '$gt': parseFloat(postQuery.y0),
      '$lt': parseFloat(postQuery.y1),
    };
  }

  if (postQuery.footprint) {
    query.footprint = {
      '$gt': parseFloat(postQuery.footprint),
    };
  }

  mongoDB.find('camic', 'mark', query).then((x) => {
    req.data = x;
    next();
  }).catch((e) => next(e));
};

Mark.findMarkTypes = function(req, res, next) {
  var query = req.query;
  if (query.slide) {
    query['provenance.image.slide'] = query.slide;
    delete query.slide;
  }
  if (query.type) {
    query['provenance.analysis.source'] = query.type;
    delete query.type;
  }
  delete query.token;

  if (query['provenance.analysis.source'] == 'human') {
    const pipeline = [
      {
        "$match": query,
      }, {
        "$group": {
          "_id": {
            "creator": "$creator",
            "analysis": "$provenance.analysis",
            "shape": "$geometries.features.geometry.type",
          },
        },
      },
    ];
    mongoDB.aggregate('camic', 'mark', pipeline).then((x) => {
      req.data = x;
      next();
    }).catch((e) => next(e));
  } else {
    mongoDB.distinct('camic', 'mark', 'provenance.analysis', query).then((x) => {
      req.data = x;
      next();
    }).catch((e) => next(e));
  }
};
Mark.updateMarksLabel = function(req, res, next) {
  var query = req.query;
  delete query.token;
  // initial data

  var newVals = {
    $set: {
      'provenance.analysis.name': query.name,
      'properties.annotations.name': query.name,
      'properties.annotations.notes': query.name,
    },
  };
  mongoDB.update('camic', 'mark',
      {
        'provenance.analysis.labelId': query.id,
      }, newVals).then((x) => {
    req.data = x;
    next();
  }).catch((e) => next(e));
};
var Heatmap = {};
Heatmap.types = function(req, res, next) {
  var query = req.query;
  delete query.token;
  mongoDB.find('camic', 'heatmap', query, {
    'data': 0,
  }).then((x) => {
    x.forEach((x)=>delete x.data);
    req.data = x;
    next();
  }).catch((e) => next(e));
};

var User = {};

User.forLogin = function(email) {
  return mongoDB.find('camic', 'user', {'email': email});
};

User.getCurrentUserId = function(req, res, next) {
  req.data = process.env.CURRENT_USER_ID;
  next();
};

User.wcido = function(req, res, next) {
  var userType = req.query.ut;
  var permissions = {
    slide: {post: true, delete: true, update: true},
    heatmap: {post: true, delete: true, update: true},
    heatmapEdit: {post: true, delete: true, update: true},
    user: {post: true, delete: true, update: true},
    config: {post: true, delete: true, update: true},
    mark: {post: true, delete: true, update: true},
    template: {post: true, delete: true, update: true},
    logs: {post: true, delete: true, update: true},
  };
  if (DISABLE_SEC || userType == 'Admin') {
    res.send(permissions);
  } else if (userType == 'Editor') {
    permissions['user'] = {post: false, delete: false, update: false};
    permissions['slide'] = {post: true, delete: false, update: true};
    res.send(permissions);
  } else if (userType == 'Null') {
    for (const key in permissions) {
      if (permissions.hasOwnProperty(key)) {
        permissions[key] = {post: false, delete: false, update: false};
        if (key == 'logs') {
          permissions[key] = {post: true, delete: false, update: false};
        }
      }
    }
    res.send(permissions);
  } else {
    var error = {error: 'undefined UserType'};
    res.send(error);
  }
};
var LabelingAnnotation = {};
LabelingAnnotation.findByTypeOrCreator = function(req, res, next) {
  const {slideId, slideName, computation, creator} = req.query;
  const query = {};
  if (slideId) query["provenance.image.slide"] = slideId;
  if (slideName) query["provenance.image.name"] = slideName;
  if (computation) query["provenance.analysis.computation"] = computation;
  if (creator) query["creator"] = creator;
  mongoDB.find('camic', 'labelingAnnotation', query, true, {"geometries": 0}).then((x) => {
    req.data = x;
    next();
  }).catch((e) => next(e));
};
LabelingAnnotation.advancedFind = async function(req, res, next) {
  // get params -
  // id - annotation id (_id)
  // slideId - slide Id (provenance.image.slide)
  // slideName - slide Name (provenance.image.name)
  // type - ROI type (properties.type)
  // creator - creator (creator)
  // alias - alias (alias)
  // startDate - create date (create_date)
  // endDate - create date (create_date)
  const {id, slideId, slideName, type, creator, alias, startDate, endDate} = req.query;
  delete req.query.token;
  const query = {};
  if (id) query["_id"] = id;

  if (slideId) query["provenance.image.slide"] = slideId;
  if (slideName) query["provenance.image.name"] = slideName;

  if (type) query["properties.type"] = type;

  if (creator) query.creator = creator;

  if (alias) query.alias = alias;
  if (startDate || endDate) {
    query.create_date = {};
    if (startDate) query.create_date['$gte'] = new Date(startDate);
    if (endDate) query.create_date['$lte'] = new Date(endDate);
  }
  mongoDB.find('camic', 'labelingAnnotation', query ).then((x) => {
    req.data = x;
    next();
  }).catch((e) => next(e));
};
var Slide = {};
Slide.download = function(req, res, next) {
  const {location} = req.query;
  try {
    fs.exists(location, (exist) => {
      if (exist) {
        const filename = path.basename(location);
        const mimetype = mime.lookup(location);
        var fileInfo = fs.statSync(location);
        const fileSize = fileInfo.size;
        const readable = fs.createReadStream(location);
        res.setHeader('content-disposition', 'attachment; filename=' + filename);
        res.setHeader('content-type', mimetype);
        res.setHeader('content-length', fileSize);
        readable.pipe(res);
      } else {
        res.sendStatus(404);
      }
    });
  } catch (error) {
    console.log('readble error', error);
  }
};
Email = {};
Email.sendRegistrationEmail = async function(req, res, next) {
  const {email, name} = req.query;
  console.log(`sendRegistrationEmail start - ${name}:${email}`);
  try {
    const emailOption = await mongoDB.find('camic', 'configuration', {config_name: 'email_option'});
    if (emailOption&&
      Array.isArray(emailOption)&&
      emailOption[0]&&
      emailOption[0].configuration.transport_option&&
      emailOption[0].configuration.context_option) {
      // get email option
      const transportOption = emailOption[0].configuration.transport_option;
      const contextOption = emailOption[0].configuration.context_option;
      contextOption.to = email;
      contextOption.subject = `FDA HTT(High Throughput Truthing) Registration Successful For ${name}`;
      contextOption.html = `<p style='font-size:1.3rem;'>Dear ${name},<br><br>
      Thank you for registering for the HTT data-collection project on caMicrscope!<br><br>
      &nbsp;&nbsp;&bull;&nbsp;&nbsp;Here's a link to return to the data-collection portal: http://htt.camicroscope.org<br>
      &nbsp;&nbsp;&bull;&nbsp;&nbsp;Here's a link to the HTT project wiki page: https://ncihub.org/groups/eedapstudies<br><br>
      If you have questions about the project, please email the me, project lead:<br><br>   
      Brandon.Gallas@fda.hhs.gov<p>`;
      var transporter = nodemailer.createTransport(transportOption);
      await transporter.sendMail(contextOption, function(error, info) {
        if (error) {
          console.log(error);
          res.status(400).json({error});
        } else {
          console.log(`Sent Registration: ${name}:${email}`);
          res.status(200).json({info});
        }
        next();
      });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({error});
  }
};

Slide.countLabeling = async function(req, res, next) {
  try {
    // {"$match": {"provenance.image.slide": {"$in": sids}}},
    const data = await mongoDB.aggregate('camic', 'labeling',
        [
          {"$group": {_id: "$provenance.image", count: {$sum: 1}}},
        ]);
    req.data = data;
    next();
  } catch (error) {
    req.data = {error};
    next();
  }
};
Slide.findLabelingStat = async function(req, res, next) {
  try {
    var query = req.query;
    const {cid, uid} = query;
    // find slide data
    const slides = await mongoDB.find('camic', 'slide', {'collections': cid}, false);

    const sids = slides.map((slide)=>slide._id.toString());

    // count labeling
    const labelings = await mongoDB.aggregate('camic', 'labeling',
        [
          {"$match": {"provenance.image.slide": {"$in": sids}}},
          {"$group": {_id: "$provenance.image.slide", count: {$sum: 1}}},
        ]);
    const labelingMap = new Map();
    labelings.forEach(({_id, count})=>{
      labelingMap.set(_id, count);
    });

    // count labelingAnnotation
    const labelingAnnotations = await mongoDB.aggregate('camic', 'labelingAnnotation', [
      {"$match": {"provenance.image.slide": {"$in": sids}, "creator": uid}},
      {"$group": {_id: "$provenance.image.slide", count: {$sum: 1}}},
    ]);
    const labelingAnnotationMap = new Map();
    labelingAnnotations.forEach(({_id, count})=>{
      labelingAnnotationMap.set(_id, count);
    });

    slides.forEach((slide)=>{
      const id = slide._id.toString();
      slide.stat = {
        labelingAnnotationCount: labelingAnnotationMap.has(id)?labelingAnnotationMap.get(id):0,
        labelingCount: labelingMap.has(id)?labelingMap.get(id):0,
      };
    });
    req.data = slides;
    next();
  } catch (error) {
    req.data = {error};
    next();
  }
};

dataHandlers = {};
dataHandlers.Heatmap = Heatmap;
dataHandlers.Email = Email;
dataHandlers.Mark = Mark;
dataHandlers.User = User;
dataHandlers.Presetlabels = Presetlabels;
dataHandlers.Labeling = Labeling;
dataHandlers.Slide = Slide;
dataHandlers.LabelingAnnotation = LabelingAnnotation;

dataHandlers.General = General;
module.exports = dataHandlers;
