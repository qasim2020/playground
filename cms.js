const chalk = require('chalk');

const path = require('path');
const fs = require('fs');
//joining path of directory 
const directoryPath = path.join(__dirname, '');

const express = require('express')
const hbs = require('hbs')
const app = express();
const flash = require('connect-flash');
const session = require('express-session');
const mongoose = require('mongoose');
const MongoStore = require('connect-mongo')(session);
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const bodyParser = require('body-parser');
var cloudinary = require('cloudinary').v2;

var env = process.env.NODE_ENV || 'development';

if (env === 'development' || env === 'test') {
  var config = require('./config000.json');
  var envConfig = config[env];
  Object.keys(envConfig).forEach((key) => {
    process.env[key] = envConfig[key];
  });
}

app.use(
  session({
    secret: process.env.sessionSecret,
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: 20 * 60 * 1000,
    },
    rolling: true,
    store: new MongoStore({
      mongooseConnection: mongoose.connection
    })
  }),
  passport.initialize(),
  passport.session(),
  flash(),
  function(req, res, next) {
    if (req.headers.accept != process.env.test_call) 
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
  },
  bodyParser.urlencoded({
    extended: true,
    limit: '50mb'
  })
);

mongoose.Promise = global.Promise;
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
  useFindAndModify: false
}, function(err) {
  if (err) {
    console.log('Unable to connect to the server. Please start the server.');
  } else {
    console.log('Connected to Server successfully!');
  }
});

let schema = {
    name: {
        type: "String",
        required: true,
    },
    owner: {
        type: "String",
        required: true,
    },
    properties: {
        type: "Object",
        required: true,
    }
};

let Collections = mongoose.model('collections', new mongoose.Schema(schema));

hbs.registerPartials(__dirname + '/views/login/partials');

hbs.registerHelper('breaklines', (val) => {
  return val.split(/\n/g).join('<br>');
})

hbs.registerHelper('checkExists', (val) => {
    return val != undefined ? 'true' : '';
})

hbs.registerHelper('matchValues', (val1,val2) => {
    console.log(val1,val2,val1 == val2);
    return val1 == val2
});

app.use('/:owner/:permit/:requiredType/:module/:input', async (req,res,next) => {
    console.log('');
    console.log(chalk.bold.red('new Request starts here'));
    console.log(req.params);

    if (myFuncs['moduleRole'][req.params.module] == 'gen') return next();
    
    if ( req.session && req.session.hasOwnProperty('person') ) {
        console.log({
            personRole: req.session.person.role,
            pagePermit: req.params.permit,
            personOwner: req.session.person.owner,
            pageOwner: req.params.owner
        });
        switch (true) {
            // Logged In User can watch all auth modules
            case (myFuncs.moduleRole[req.params.module] == 'auth'):
                return next();
            // Admin == Admin && root == root
            case (myFuncs.moduleRole[req.params.module] == 'admin' && req.session.person.role == 'auth'): 
                return res.send('you are trying to access admin page while your role is auth only');
                break;
            case (req.session.person.role == req.params.permit && req.session.person.owner == req.params.owner) :
                return next();
                break;
            // 'Auth' role tries to access 'Admin' Module
            default :
                return res.send('you are not authorized to make this request');
                break;
        };
    };
    
    let checkCollectionExists = await myFuncs.checkCollectionExists(`${req.params.owner}-users`);
    console.log(checkCollectionExists, `${req.params.owner}-users`);

    if (checkCollectionExists) {
        return res.redirect(`/${req.params.owner}/gen/page/signin/home/`);
    };
    
    checkCollectionExists = await myFuncs.checkCollectionExists(`myapp-users`);
    console.log(checkCollectionExists, `${req.params.owner}-users`);

    if (checkCollectionExists) {
        return res.redirect(`/myapp/gen/page/signin/home/`);
    };

    checkCollectionExists = await myFuncs.checkCollectionExists(`collections`); 
    let checkCollectionHasValues = await Collections.find().lean();
    console.log(checkCollectionExists, 'collections', checkCollectionHasValues.length);
    if (checkCollectionExists == false || checkCollectionHasValues.length == 0) {
        let data = {
            name: 'collections',
            owner: 'root',
            properties: schema,
        };
        let output = await myFuncs.save(Collections,data);
        console.log(chalk.bold.red('first collection created'));
        console.log(output);
        return next();
    };

    console.log(chalk.bold.yellow('All checks completed moving to admin route!'));
    next();
});

app.get('/:owner/:permit/:requiredType/:module/:input', async (req,res) => {

    try {
        let data = await myFuncs[req.params.module](req,res);
        req.params.theme = await myFuncs.getThemeName(req.params.owner);
        // if this theme (folder) does not contain this module (page) return 'this module / page does not exist in current theme';
        // let modules = await myFuncs.getDirectoryList(req.params.theme);
        // let matchNotFound = modules.every(val => val.split('.')[0] != req.params.module);
        // if (matchNotFound) throw 'module does not exist in this theme';
        myFuncs.respond(data,req,res);
    } catch(e) {
        console.log(e);
        res.status(e.status || 400).send(e);
    }

});

app.post('/:owner/:permit/:requiredType/:module/:input', async (req,res) => {

    try {
        let data = await myFuncs[req.params.module](req,res);
        req.params.theme = await myFuncs.getThemeName(req.params.owner);
        // if this theme (folder) does not contain this module (page) return 'this module / page does not exist in current theme';
        myFuncs.respond(data,req,res);
    } catch(e) {
        console.log(e);
        res.status(e.status || 400).send(e);
    }

});

var myFuncs = {

    moduleRole: {
        respond: 'admin',
        runAndRedirect: 'gen',
        newDocument: 'admin',
        editDocument: 'admin',
        deleteDocument: 'admin',
        checkCollectionExists: 'admin',
        createModel: 'admin',
        save: 'admin',
        dropCollection: 'admin',
        createNewCollection: 'admin',
        saveSequence: 'gen',
        updateSequence: 'admin',
        showCollection: 'admin',
        destroySession: 'auth',
        checkAdmin: 'admin',
        signin: 'gen',
        checkSignIn: 'gen',
        signup: 'gen',
        home: 'auth',
    },

    respond: async function(data,req,res) {
        console.log(chalk.bold.yellow('sending data to page ====='));
        console.log(data);
        switch(true) {
          case (data.error): 
            return res.status(data.status).send(data.error);
            break;
          case (req.query.hasOwnProperty('redirect')):
            return res.redirect(`/${req.params.owner}/${req.params.permit}/${req.params.requiredType}/${req.query.redirect}/${req.query.redirectInput}`);
            break;
          case (req.params.requiredType == 'data'):
            return res.status(200).send(data);
            break;
          case (req.params.requiredType == 'page'):
            console.log(req.params);
            return res.status(200).render(`${req.params.theme}/${req.params.module}.hbs`,{data});
            break;
          default:
        }
    },

    getThemeName: async function(brand) {
        let themesExist = await this.checkCollectionExists('myapp-themes');
        if (themesExist == false) return 'root';
        let theme = await myFuncs.createModel(`myapp-themes`);
        let extract = await theme.findOne({brand: brand}).lean();
        console.log(extract);
        if (extract == null) return 'root'; 
        console.log({theme: extract.theme, brand: brand});
        return extract.theme;
    },

    getDirectoryList : async function(directoryName) {
        return new Promise ((resolve,reject) => {
            fs.readdir(directoryPath + '/views/' + directoryName, function (err, files) {
                if (err) {
                    console.log('Unable to scan directory: ' + err);
                    return reject('Unable to scan directory: ' + err);
                }
                return resolve(files);
            });
        });
    },

    getFormInputs: async function(req,res) {
        let collection = await Collections.findOne({name: req.params.input}).lean();
        let properties = collection.properties;
        let keys = Object.keys(collection.properties);
        let values = Object.values(collection.properties);
        let output = keys.map(val => {
            return {
                label: val.charAt(0).toUpperCase() + val.slice(1),
                type: properties[val]['type'] == 'String' ? 'input' : 'radio',
                name: val,
                id: val,
                required: 'required',
                value: req.values && req.values[val] 
            };
        });
        return output;
    },

    newDocument: async function(req,res) {
        let output = await this.getFormInputs(req,res);
        output.collection = req.params.input;
        output.owner = req.params.owner;
        return output;
    },

    editDocument: async function(req,res) {
        let model = await this.createModel(req.params.input);
        req.values = await model.findOne({_id: req.query._id}).lean();
        if (req.values == undefined) return {status: 404, error: 'document does not exist so it can not be edited'};
        let output = await this.getFormInputs(req,res);
        output.collection = req.params.input;
        output._id = req.query._id;
        output.owner = req.params.owner;
        return output;
    },

    updateSequence: async function(req,res) {
        console.log(req.body);
        let model = await this.createModel(req.body.modelName);
        let result = await model.findOneAndUpdate({_id: req.body._id},req.body,{new: true}).lean();
        if (result == undefined) return {status: 404, error: 'did not find matching document'};
        return result;
    },

    checkCollectionExists: async function(collectionName) {
        let result = await mongoose.connection.db.listCollections().toArray();
        return result.some(val => val.name == `${collectionName}`);
    },

    createModel : async function(modelName) {
        let modelExistsAlready = Object.keys(mongoose.models).some(val => val == modelName);
        let schemaExistsAlready = Object.keys(mongoose.modelSchemas).some(val => val == modelName);

        if (modelExistsAlready) return mongoose.models[modelName];

        let schema = await Collections.findOne({name: modelName}).lean();
        
        return mongoose.model(modelName, new mongoose.Schema(schema.properties));
        
    },

    save : async function(model,data) {
        try {
            const doc = new model(data);
            let output = await doc.save();
            return {success: 'Done'};
        } catch(e) {
            console.log(e);
            return {status: 404, error: 'Failed'}
        };
    },
    
    dropCollection: async function(req,res) {
        try {
            await mongoose.connection.db.dropCollection(req.params.input);
            return {
                success: 'collection dropped'
            }
        } catch (e) {
            return {
                error: e
            }
        };
    },

    createNewCollection : function(req,res) {
        if (req.params.input == 'n') return {
            error: 'Please give collection Name'
        };
        console.log(`creating new collection at ${req.params.input}`);
        return {
            owner: req.params.owner,
            name: req.params.owner + '-' + req.params.input,
            types: ['String','Number','Array','Object','Options','CheckBoxes']
        };
    }, 

    saveSequence: async function(req,res) {
        console.log(req.body);
        let model = await this.createModel(req.body.modelName);
        let output = await this.save(model,req.body); 
        console.log(output);
        console.log('save sequence ends here');
        return output;
    },        

    showCollection: async function(req,res) {
        let collectionsTable = await Collections.find({owner: req.params.owner}).lean();
        let navRows = collectionsTable.map(val => val.name);
        console.log({collectionsTable: collectionsTable});
        if (collectionsTable.length == 0) return {
            status:200, 
            success: 'no data exists in this collection.',
            owner: req.params.owner
        };

        let collectionHeadings = Object.keys(collectionsTable.find(val => val.name == req.params.input).properties);
        collectionHeadings.unshift('_id');
        collectionHeadings = collectionHeadings.concat(['edit','delete']);
        let model = await this.createModel(req.params.input);
        let dataRows = await model.find().lean();
        let newRows = dataRows.map(val => {
            let total = [];
            for (i=0; i<collectionHeadings.length; i++) {
                switch (true) {
                    case (collectionHeadings[i] == 'edit'):
                        total.push(`<a href="/${req.params.owner}/admin/page/editDocument/${req.params.input}?_id=${val._id}">Edit</a>`)
                        break;
                    case (collectionHeadings[i] == 'delete'):
                        total.push(`<a href="/${req.params.owner}/admin/page/deleteDocument/${req.params.input}?_id=${val._id}&redirect=showCollection&redirectInput=${req.params.input}">Delete</a>`)
                        break;
                    default:
                        total.push(val[collectionHeadings[i]]);
                }
            }
            return total;
        });

        return {
            owner: req.params.owner,
            modelName: req.params.input,
            navRows: navRows,
            th: collectionHeadings,
            dataRows: newRows
        };
    },

    destroySession: function(req,res) {
        req.session.destroy();
        return {
            status: 200,
            redirect: req.params.input,
            success: 'Session Destroyed'
        };
    },

    deleteDocument: async function(req,res) {
        console.log(req.query);
        console.log(req.params.input);
        let model = await this.createModel(req.params.input);
        let result = await model.deleteOne({_id: req.query._id});
        return {
            status: 200,
            success: result 
        };
    },

    signin: function(req,res) {
        return {
            status: 200,
            success: 'sign in page comes here',
            owner: req.params.owner,
        };
    },

    signup: function(req,res) {
        return {
            status: 200,
            success: 'sign up page comes here',
            owner: req.params.owner
        }
    },

    checkSignIn: async function(req,res) {
        let model = await this.createModel(`${req.params.owner}-users`);
        let output = await model.findOne({email: req.body.email, password: req.body.password}).lean();
        console.log(`user found in ${req.params.owner}-users`,output);
        // if 7am does not have this user look into myapp. it can be an owner. 
        if (!output) {
            model = await this.createModel('myapp-users');
            output = await model.findOne({email: req.body.email, password: req.body.password}).lean();
            console.log(`user found in ${req.params.owner}-users`,output);
        };
        // If still no user found , return mismatch
        if (!output) return {status: 400, error: 'Email Password Mismatch. Please Sign Up.'};
        req.session.person = output;
        req.session.person.owner = output.owner || req.params.owner;
        return {
            status:200, 
            success: 'Successfully logged in',
            owner: output.owner || req.params.owner,
            role: output.role
        };
    },

    runAndRedirect: async function(req,res) {
        // /root/admin/data/runAndRedirect/deleteDocument?_id=123123&&redirect=showCollection&redirectInput=root-users
        let output = await this[req.params.input][req.query.input]; 
        return res.redirect(`/${req.params.owner}/${req.params.permit}/${req.params.requiredType}/${req.query.redirect}/${req.query.redirectInput}`);
    },

    checkAdmin:  function(username,owner) { // find if Username in Session Variable matches the Owner Name in root-users database
        Users.findOne({person: username, owner: owner}).then(val => val !== null).catch(e => false); // dummy
    }
};

app.listen(3000)
