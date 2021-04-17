const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
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
const { WebClient } = require('@slack/web-api');
const http = require('http');
const server = http.createServer(app);
const socketio = require('socket.io');
const io = socketio(server);

var qpm = require('query-params-mongo');
let getObjectId = function(val) {
    return mongoose.Types.ObjectId(val);
};
var processQuery = qpm({
    autoDetect: [
        { fieldPattern: /_id$/, dataType: 'objectId' },
        { fieldPattern: /orderNo$/, dataType: 'string' },
    ],
    converters: {objectId: getObjectId }
});


var cloudinary = require('cloudinary').v2;
var env = process.env.NODE_ENV || 'development';

if (env === 'development' || env === 'test') {
  var config = require('./config000.json');
  var envConfig = config[env];
  Object.keys(envConfig).forEach((key) => {
    process.env[key] = envConfig[key];
  });
}

const web = new WebClient();

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
  express.static(__dirname+'/static'),
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
  bodyParser.json({limit: '50mb'}),
  bodyParser.urlencoded({
    extended: true,
    limit: '50mb',
    parameterLimit: 1000000
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

cloudinary.config({
  cloud_name: process.env.cloudName,
  api_key: process.env.cloudAPI,
  api_secret: process.env.cloudAPISecret
});

let schema = {
    name: {
        type: "String",
        required: true,
    },
    brand: {
        type: "String",
        required: true,
    },
    redirect: {
        type: "String",
        required: false
    },
    properties: {
        type: "Object",
        required: true,
    }
};

let Collections = mongoose.model('collections', new mongoose.Schema(schema));

hbs.registerPartials(__dirname + '/views/partials');

hbs.registerHelper('breaklines', (val) => {
  return val.split(/\n/g).join('<br>');
})

hbs.registerHelper('startWithUpperCase', (val) => {
    return val.charAt(0).toUpperCase() + val.slice(1)
});

hbs.registerHelper('checkExists', (val) => {
    return val != undefined ? 'true' : '';
})

hbs.registerHelper('matchValues', (val1,val2) => {
    return val1 == val2
});

hbs.registerHelper('removeSpaces', (val) => {
    return val.replace(/ /gi,'');
});

hbs.registerHelper('match', function(val1,val2) {
  // console.log(val1,val2);
  return val1.toUpperCase() == val2.toUpperCase() ? true : false;
})

hbs.registerHelper('split0', (val) => {
    try {
    let output =  val.split(' ')[0] == undefined ? val : val.split(' ')[0] ;
    return output;
    } catch(e) {
        return val
    }
});

hbs.registerHelper('split1', (val) => {
    try {
        let output =  val.split(' ')[1] == undefined ? val : val.split(' ')[1] ;
        return output;
    } catch(e) {
        return val
    }
});

hbs.registerHelper('split2', (val) => {
    try {
        let output =  val.split(' ')[2] == undefined ? val : val.split(' ')[2] ;
        return output;
    } catch(e) {
        return val
    }
});

hbs.registerHelper('split', (val) => {
    let output = val.split(' ');
    return output;
});

app.use('/:brand/:permit/:requiredType/:module/:input', async (req,res,next) => {
    console.log('');
    console.log(chalk.bold.red('new Request starts here'));
    console.log(req.params);

    if (myFuncs['moduleRole'][req.params.module] == 'gen') return next();
    
    if ( req.session && req.session.hasOwnProperty('person') ) {
        console.log({
            personRole: req.session.person.role,
            pagePermit: req.params.permit,
            personOwner: req.session.person.brand,
            pageOwner: req.params.brand
        });
        switch (true) {
            // Logged In User can watch all auth modules
            case (myFuncs.moduleRole[req.params.module] == 'auth'):
                return next();
            // Admin == Admin && root == root
            case (myFuncs.moduleRole[req.params.module] == 'admin' && req.session.person.role == 'auth'): 
                return res.send('you are trying to access admin page while your role is auth only');
                break;
            case (req.session.person.role == req.params.permit && req.session.person.brand == req.params.brand) :
                return next();
                break;
            // 'Auth' role tries to access 'Admin' Module
            default :
                return res.send('you are not authorized to make this request');
                break;
        };
    };
    
    let collectionsSavedCheck = await Collections.findOne({name: "collections"}).lean();
    if (collectionsSavedCheck == undefined) {
        let data = {
            name: 'collections',
            brand: 'myapp',
            properties: schema,
        };
        let output = await myFuncs.save(Collections,data);
        console.log(chalk.bold.red('first collection created'));
        return next();
    };

    let checkCollectionExists = await myFuncs.checkCollectionExists(`${req.params.brand}-users`);

    if (checkCollectionExists) {
        return res.redirect(`/${req.params.brand}/gen/page/signin/home/`);
    };
    
    checkCollectionExists = await myFuncs.checkCollectionExists(`myapp-users`);

    if (checkCollectionExists) {
        return res.redirect(`/myapp/gen/page/signin/home/`);
    };


    console.log(chalk.bold.yellow('All checks completed moving to admin route!'));
    next();
});

let openBrand = async (req,res) => {
    if (req.params.brand.indexOf('.') > 0) {
        console.log( chalk.bold.red("===== Wrong Call ===== \n", req.params.brand ) );
        return res.status(300).send('Wrong Attempt');
    };

    return res.redirect(`/${req.params.brand}/gen/page/landingPage/n`);
};

let openAdmin = async (req,res) => {
    return res.redirect(`/${req.params.brand}/admin/page/signin/n`);
};

let replyFunction = async (req,res) => {

    try {
        req.params.theme = await myFuncs.getThemeName(req.params.brand);
        let data = await myFuncs[req.params.module](req,res);
        myFuncs.respond(data,req,res);
    } catch(e) {
        console.log(e);
        res.status(e.status || 400).send(e);
    }

};

app.get(  '/:brand/:permit/:requiredType/:module/:input', replyFunction );
app.post( '/:brand/:permit/:requiredType/:module/:input', replyFunction );
app.get(  '/:brand', openBrand);
app.get(  '/:brand/admin', openAdmin);
app.get(  '/', async (req,res) => {
    // HERE ADD THE NEW APP YOU ARE WORKING ON
    return res.status(200).render('root/showApps.hbs',{
        apps: [
            {
                name: 'My App',
                url: 'myapp'
            },
            {
                name: '7am',
                url: '7am',
            },
            {
                name: 'trends',
                url: 'trends',
            },
            {
                name: '30 Days Challenge',
                url: 'challenge',
            },
            {
                name: 'portfolio',
                url: 'life'
            }
        ]
    });
});

var myFuncs = {

    respond: async function(data,req,res) {
        console.log( chalk.bold.yellow('sending data to page') ); 
        // console.log(JSON.stringify(data,'',2));
        switch(true) {
          case ( data.hasOwnProperty('error') ): 
            return res.status(data.status).send(data.error);
            break;
          case (req.query.hasOwnProperty('redirect')):
            return res.redirect(`/${req.params.brand}/${req.params.permit}/${req.params.requiredType}/${req.query.redirect}/${req.query.redirectInput}`);
            break;
          case (req.params.requiredType == 'data'):
            return res.status(200).send(data);
            break;
          case (req.params.hasOwnProperty('pageName')): 
            return res.status(200).render(`${req.params.theme}/${req.params.pageName}.hbs`,{data});
            break;
          case (req.headers['x-pjax'] == 'true'):
            return res.status(200).render(`${req.params.theme}/pjax/${req.params.module}.hbs`,{data});
            break;
          case (req.headers['x-pjax'] != 'true' && req.params.requiredType == 'pjax'): 
            return res.redirect(`/${req.params.brand}/${req.params.permit}/page/${req.params.input}/${req.query.input || 'n'}`);
            break;
          case (req.params.requiredType == 'page'):
            return res.status(200).render(`${req.params.theme}/${req.params.module}.hbs`,{data});
            break;
          default:
        }
    },

    moduleRole: {
        respond: 'admin',
        runAndRedirect: 'gen',
        newDocument: 'admin',
        editDocument: 'admin',
        deleteDocument: 'admin',
        checkCollectionExists: 'admin',
        createModel: 'admin',
        airtablePull: 'admin',
        mergeDataIntoCollection: 'admin',
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
        landingPage: 'gen',
        searchItems: 'gen',
        cartPage: 'gen',
        getMongoId: 'gen',
        reviewCartPage: 'gen',
        updateCart: 'gen',
        removeItemFromCart: 'gen',
        orderReceiptPage: 'gen',
        profilePage: 'gen',
        createOrder: 'gen',
        findOrderPage: 'gen',
        itemPage: 'gen',
        saveItemInCart: 'gen',
        mongoQueries: 'gen',
        showOrders: 'admin',
        getSizes: 'gen',
        showPage: 'gen',
        updatePage: 'admin',
        dashboard: 'admin',
        forgotpw: 'gen',
        challenges: 'auth',
        profile: 'auth',
        openChallenge: 'auth',
        dashboardBlogs: 'admin',
        addNewBlog: 'admin',
        saveBlog: 'admin',
        openBlog: 'gen',
        subscribeCustomer: 'gen',
    },

    getThemeName: async function(brand) {
        try {
            let themesExist = await this.checkCollectionExists('myapp-themes');
            if (themesExist == false) return 'root';
            let theme = await myFuncs.createModel(`myapp-themes`);
            let extract = await theme.findOne({brand: brand}).lean();
            if (extract == null) return 'root'; 
            return extract.theme;
        } catch (e) {
            return 'root';
        }
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
            if (properties[val]['html'] == 'imgURL' && req.values && req.values[val] != undefined) {
                req.values[val] = req.values && req.values[val].split(' ');
            }
            return {
                label: val.charAt(0).toUpperCase() + val.slice(1),
                type: properties[val]['html'],
                name: val,
                id: val,
                required: properties[val]['required'] || 'true',
                value: req.values && req.values[val] 
            };
        });
        return output;
    },

    fetchResources: async function(req,res) {
        try {
            let resources = await this.createModel(`${req.params.brand}-resources`);
            let result = await resources.find({});
            return result;
        } catch(e) {
            return e;
        }
    },

    newDocument: async function(req,res) {
        let inputs = await this.getFormInputs(req,res);
        let output = {
            inputs: inputs,
            collection: req.params.input,
            brand: req.params.brand,
            _id: this.getMongoId(req,res),
            resources: await this.fetchResources(req,res)
        };
        req.params.theme = 'ecommerce';
        req.params.module = 'editDocument';
        return output;
    },

    editDocument: async function(req,res) {
        let model = await this.createModel(req.params.input);
        req.values = await model.findOne({_id: req.query._id}).lean();
        if (req.values == undefined) return {status: 404, error: 'document does not exist so it can not be edited'};
        let inputs = await this.getFormInputs(req,res);

        req.params.theme = 'ecommerce';
        
        let output = {
            inputs: inputs,
            collection: req.params.input,
            brand: req.params.brand,
            _id: req.query._id,
            resources: await this.fetchResources(req,res)
        };

        return output;
    },

    updateSequence: async function(req,res) {
        let model = await this.createModel(req.body.modelName);
        let result = await model.findOneAndUpdate({_id: req.body._id},req.body,{new: true, upsert: true}).lean();
        if (result == undefined) return {status: 404, error: 'did not find matching document'};
        return {success: true, result: result};
    },

    checkCollectionExists: async function(collectionName) {
        let result = await mongoose.connection.db.listCollections().toArray();
        return result.some(val => val.name == `${collectionName}`);
    },

    createModel : async function(modelName) {

        try {
            let modelExistsAlready = Object.keys(mongoose.models).some(val => val == modelName);
            let schemaExistsAlready = Object.keys(mongoose.modelSchemas).some(val => val == modelName);
            if (modelExistsAlready) { mongoose.models[modelName] = ''; };
            let schema = await Collections.findOne({name: modelName}).lean();
            console.log({modelName});
            return mongoose.model(modelName, new mongoose.Schema(schema.properties, { timestamps: { createdAt: 'created_at' } }));
        } catch(e) {
            console.log( chalk.blue.bold( 'Failed to create Model' ) );
            return e;
        }
        
    },

    airtablePull: async function(req,res) {
        console.log('show airtable pull page here');
        req.params.theme = 'root';
        return {
            brand: req.params.brand,
            collection: req.params.input
        };
    },

    mergeDataIntoCollection : async function(req,res) {
        console.log(' merge data into collection here ');
        // console.log( JSON.parse(req.body.data) );
        console.log(req.body.results);

        let model = await this.createModel(req.params.input);
        let output = await model.insertMany(req.body.results);
        console.log(output);
        return {success: true, output: output}
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
    
    deleteFromCollection: async function(req,res) {
        let output = Collections.deleteOne({name: req.params.input});
        return output;
    },

    dropCollection: async function(req,res) {
        try {
            let collectionName = req.params.input.indexOf('-') > 0 ? req.params.input.split('-')[1] : req.params.input;
            let output = await Collections.remove({name: `${req.params.brand}-collectionName`});
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

    getTypes: function(req,res) {
        return [
            {
                name: 'String',
                html: 'input'
            },{
                name: 'Number',
                html: 'numberInput'
            },{
                name: 'Array',
                html: 'checkBoxes',
            },{
                name: 'String',
                html: 'imgURL',
            },{
                name: 'String',
                html: 'selectForeignKey'
            },{
                name: 'Object',
                html: 'JSON'
            }
        ];
    },

    createNewCollection : function(req,res) {
        if (req.params.input == 'n') return {
            error: 'Please give collection Name'
        };
        let types = this.getTypes();

        req.params.theme = 'root';
        req.params.module = 'editCollection';
        return {
            _id: this.getMongoId(req,res),
            brand: req.params.brand,
            name: req.params.brand + '-' + req.params.input,
            types: types,
        };
    }, 

    editCollection: async function(req,res) {
        if (req.params.input == 'n') return {
            error: 'Please give a Collection Name'
        };

        let collectionDetails = await Collections.findOne({name: req.params.input}).lean();
        let output = Object.keys(collectionDetails.properties).map(val => {
            return {
                name: val,
                type: collectionDetails.properties[val].type,
                required: collectionDetails.properties[val].required,
                html: collectionDetails.properties[val].html == undefined ? 'input' : collectionDetails.properties[val].html
            };
        });
        let types = this.getTypes();
        req.params.theme = 'root';
        return {
            _id: collectionDetails._id,
            brand: collectionDetails.brand,
            theme: req.params.theme,
            name: collectionDetails.name,
            redirect: collectionDetails.redirect,
            types: types,
            inputs: output
        };
    },

    saveSequence: async function(req,res) {
        let model = await this.createModel(req.body.modelName);
        let output = await this.save(model,req.body); 
        return output;
    },        

    showCollection: async function(req,res) {
        let collectionsTable = await Collections.find({brand: req.params.brand}).lean();

        if (collectionsTable.length == 0) return {
            status:200, 
            success: 'no Collection exists yet. Try starting the app with basic configurations.',
            brand: req.params.brand
        };

        let inputCollection = await Collections.findOne({name: req.params.input}).lean();

        if (
            inputCollection.hasOwnProperty('redirect') && 
            inputCollection.redirect != 'showCollection' && 
            inputCollection.redirect != '' &&
            req.isLocal != true // IS IT A LOCAL REQUEST 
        ) {
            req.query.redirect = inputCollection.redirect && inputCollection.redirect.split('/')[0] || 'showCollection';
            req.query.redirectInput = inputCollection.redirect && inputCollection.redirect.split('/')[1] || 'n';
            return {
                status: 200,
                success: 'Request is now redirected to redirected page mentioned inside the database',
                brand: req.params.brand
            }
        };

        let navRows = collectionsTable.map(val => val.name);

        req.params.input = req.params.input == 'n' ? `${req.params.brand}-users` : req.params.input;

        let collectionHeadings = Object.keys(collectionsTable.find(val => val.name == req.params.input).properties);

        collectionHeadings.unshift('_id');

        let model = await this.createModel(req.params.input);
        let dataRows = await model.find().lean();
        let newRows = dataRows.map(val => {
            let total = [];
            for (i=0; i<collectionHeadings.length; i++) {
                switch (true) {
                    case (collectionHeadings[i] == 'properties'):
                        total.push(JSON.stringify(val[collectionHeadings[i]]));
                        break;
                    default:
                        total.push(val[collectionHeadings[i]]);
                }
            }
            return total;
        });


        // STATIC THEME OF ROOT WHEN SHOWCOLLECTION IS USED
        req.params.theme = 'root';

        model = await this.createModel(`${req.params.brand}-notifications`);

        let notifications = {
            count: await model.countDocuments({status: 'unread'}),
            texts: await model.find({status: 'unread'})
        };

        return {
            notifications: notifications,
            brand: req.params.brand,
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
        let model = await this.createModel(req.params.input);
        let result = await model.deleteOne({_id: req.query._id});
        return {
            status: 200,
            success: result 
        };
    },

    forgotpw: async function(req,res) {
        console.log('Send a 4 digit code here');
        return {success: true}
    },

    signin: async function(req,res) {
        return {
            status: 200,
            brand: req.params.brand,
            nextPage: req.query.nextPage,
            nextPageInput: req.query.nextPageInput,
            resources: await this.fetchResources(req,res),
            // countCart: await this.countItemsInCart(req,res),
        };
    },

    signup: function(req,res) {
        return {
            status: 200,
            success: 'sign up page comes here',
            brand: req.params.brand
        }
    },

    checkSignIn: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-users`);
        let output = await model.findOne({email: req.body.email, password: req.body.password}).lean();
        // if 7am does not have this user look into myapp. it can be an brand. 
        if (!output) {
            model = await this.createModel('myapp-users');
            output = await model.findOne({email: req.body.email, password: req.body.password}).lean();
        };

        // If still no user found , return mismatch
        if (!output) return {status: 400, error: 'Email Password Mismatch. Please Sign Up.'};
        req.session.person = output;
        req.session.person.brand = output.brand || req.params.brand;
        return {
            status:200, 
            success: 'Successfully logged in',
            brand: output.brand || req.params.brand,
            role: output.role
        };
    },

    runAndRedirect: async function(req,res) {
        // /root/admin/data/runAndRedirect/deleteDocument?_id=123123&&redirect=showCollection&redirectInput=root-users
        let output = await this[req.params.input][req.query.input]; 
        return res.redirect(`/${req.params.brand}/${req.params.permit}/${req.params.requiredType}/${req.query.redirect}/${req.query.redirectInput}`);
    },

    bulkUpload: async function(req,res) {
        let collection = await Collections.findOne({name: req.params.input}).lean();
        let properties = collection.properties;

        let collectionHeadings = Object.keys(properties);
        collectionHeadings.unshift('_id');

        req.params.theme = 'ecommerce';

        return {
            brand: req.params.brand,
            collection: req.params.input,
            sampleRow: collectionHeadings,
            resources: await this.fetchResources(req,res)
        }
    },
    array2CSV: function(twoDiArray) {
        var csvRows = [];
        for (var i = 0; i < twoDiArray.length; ++i) {
            for (var j = 0; j < twoDiArray[i].length; ++j) {
                twoDiArray[i][j] = '\"' + twoDiArray[i][j] + '\"';  
            }
            csvRows.push(twoDiArray[i].join(','));
        }
        var csvString = csvRows.join('\r\n');
        return csvString;
    },

    downloadCSVFile: async function(req,res) {
        let collection = await Collections.findOne({name: req.params.input}).lean();
        let properties = collection.properties;

        let collectionHeadings = Object.keys(properties);
        collectionHeadings.unshift('_id');
        let model = await this.createModel(req.params.input);
        let dataRows = await model.find().lean();
        let newRows = dataRows.map(val => {
            let total = [];
            for (i=0; i<collectionHeadings.length; i++) {
                total.push(val[collectionHeadings[i]]);
            }
            return total;
        });
        newRows.unshift(collectionHeadings);
        csv = this.array2CSV(newRows);

        return new Promise ((resolve,reject) => {
            fs.writeFile('./static/myFile.csv', csv, (err) => {
                if (err) {
                  return reject(err);
                }
                resolve('myFile.csv');
            });
        });
    },

    uploadMany: async function(req,res) {
        let model = await this.createModel(req.params.input);
        let mongoId =   req.body.data.map( val => val._id.match(/^[0-9a-fA-F]{24}$/) ? val._id : new mongoose.mongo.ObjectID() );
        let dataWithOutId = req.body.data.map( val => delete val._id );
        let output = await Promise.all(req.body.data.map((val,index) => model.findOneAndUpdate({_id: mongoId[index]},val,{new: true,upsert:true}) ));
        return {status: 200, 'success': 'uploadMany Successful!'};
    },

    string2Array: function(variable,separator) {
        return variable.split(' ');
    },

    ecommerce: async function(req,res) {
        // cart, schools, items, resources, categories
        let models = {};
        models.cart= await this.createModel(`${req.params.brand}-cart`);
        models.items= await this.createModel(`${req.params.brand}-items`);
        models.resources= await this.createModel(`${req.params.brand}-resources`);
        let output = await Promise.all([
            models.cart.find({sessionId: req.sessionID}) ,
            models.items.distinct('school',{}) ,
            models.items.find({ quantity : { $ne: 0 } } ),
            models.resources.find({}) ,
            models.items.distinct('category', {}) ,
            this.countItemsInCart(req,res) ,
        ]);
        output = {
            cart: output[0],
            countCart: output[5], 
            schools: output[1],
            items: output[2].filter( (val,index,self) => { 
                let connectingIDs = self.map( val => val.connectingID );
                return connectingIDs.indexOf(val.connectingID) === index ;
            }),
            resources: output[3],
            categories: output[4],
            email: req.session.person && req.session.person.email,
            sessionID: req.sessionID,
            brand: req.params.brand
        };
        return output;
    },

    root: function(req,res) {
        return {success: true};
    },

    daysSinceDate: function(start,end) {
        // To set two dates to two variables
        var date1 = new Date(start);
        var date2 = new Date(end);

        // To calculate the no. of time between two dates
        var Difference_In_Time = date2.getTime() - date1.getTime();

        // To calculate the no. of days between two dates
        var difference = Math.ceil(Difference_In_Time / (1000 * 3600 * 24));

        return difference;
    },

    life: async function(req,res) {
        let model = await this.createModel(`life-blogs`);
        let output = await model.find().sort({ser: -1}).lean();

        let start_date = "01/01/2020";
        let difference = this.daysSinceDate(start_date,new Date());

        let array = [], this_date;

        for (let i = 1 ; i < difference ; i++) {
            this_date = new Date(new Date(start_date).getTime() + (1000 * 60 * 60  * 24 * i) ) ;
            array.push( {
                date: this_date,
                blog: output.find( val => {
                    let diff = Math.ceil( (new Date(val.date).getTime() - this_date.getTime()) / 1000 / 60 / 60 / 24 );
                    return Math.abs( diff ) < 1;
                }),
                postNo: i,
            });
        }

        array.sort( (a,b) => b.postNo - a.postNo );

        return {blogs: array};
    },

    challenge: async function(req,res) {
        return {
            sessionExists: req.session.hasOwnProperty('person') 
        };
    },

    landingPage: async function(req,res) {
        console.log({theme: req.params.theme});
        let output = this[req.params.theme](req,res);
        return output;
    },

    mongoQueries: async function(req,res) {
        let model = await ( await this.createModel(`${req.params.brand}-${req.params.input}`) ).find({}).lean();
        let models = await Promise.all( model.map((val) => this.createModel(val.collectionName) ));
        let output = await Promise.all( models.map((val,index) => { 
            let query = model[index].query.split(',');
            switch(true) {
                case ( /req.session._id/gi.test(query[0]) ) :
                    // TODO: Make the session ID concatanate with Database Query
                    query[0] = {sessionId: req.sessionID};
                    break;
                default : 
                    query[0] = JSON.parse(query[0]);
            };
            let mongoQuery = {
                query: query[0] ? query[0] : {},
                select: query[1] ? JSON.parse(query[1]) : {},
                cursor: query[2] ? JSON.parse(query[2]) : {},
            };
            result = val.find(mongoQuery.query, mongoQuery.select, mongoQuery.cursor).lean();
            return result;
        }) );

        let variables = model.map(val => val.variable);
        
        output = output.reduce((total,val,index)  => {
            switch(true) {
                case (model[index]['specialMethod'] && model[index]['specialMethod'].length != 0) :
                    let specialMethodName = model[index]['specialMethod'].split(' ')[0];
                    let dataKeyName = model[index]['specialMethod'].split(' ')[1];
                    val = val.map(v => {
                        v[dataKeyName] = this[specialMethodName]( v[dataKeyName] )
                        return v;
                    });                   
                default: 
                    total = Object.assign(total, {
                        [variables[index]] : val
                    });
            };
            return total;
        },{});
        output = Object.assign(output, {
            email: req.session.person && req.session.person.email,
            sessionID: req.sessionID
        });
        req.params.pageName =  req.params.input;
        return output;
    },

    uploadCloudinary: async function(req,res) {
        let output = await cloudinary.uploader.upload(req.body.img,
              {
                resource_type: "image",
                public_id: req.body.public_id || mongoose.Types.ObjectId().toString(),
                folder: req.params.brand,
                overwrite: true,
                transformation: [
                  { width: req.body.width, height: req.body.height, crop: "limit" }
                ],
              });
        return output;
    },

    searchItems: async function(req,res) {

        let query = {};

        if (req.body.itemName && req.body.itemName.length > 0) query.name = new RegExp(req.body.itemName,'i');
        if (req.body.selectedCategories && req.body.selectedCategories.length > 0) query.category = { $in : req.body.selectedCategories };
        if (req.body.selectedSchools && req.body.selectedSchools.length > 0) query.school = { $in : req.body.selectedSchools };

        let model = await this.createModel(`${req.params.brand}-items`);
        let output = await model.find(query);
        
        output = output.filter( (val,index,self) => { 
                let connectingIDs = self.map( val => val.connectingID );
                return connectingIDs.indexOf(val.connectingID) === index ;
            });

        output = {
            result: output,
            email: req.session.person && req.session.person.email ,
            sessionId: req.sessionID
        };

        return output;
    },



    getCartItems: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-cart`);
        let result = await model
            .aggregate([
            {
                $match: {
                    $or: [
                        {sessionId: req.sessionID },
                        {email: req.session.person && req.session.person.email }
                    ],
                    cartStatus: req.params.hasOwnProperty('cartStatus') ? req.params.cartStatus : 'open' 
                }
            },{
                $addFields:
                {
                    itemId: { $toObjectId: "$itemId" }
                }
            },{
                $lookup:
                 {
                   from: `${req.params.brand}-items`,
                   localField: 'itemId',
                   foreignField: '_id',
                   as: 'items'
                 }
            },{
                $lookup:
                 {
                   from: `${req.params.brand}-items`,
                   localField: 'connectingID',
                   foreignField: 'connectingID',
                   as: 'allSizes'
                 }
            }
            ]);
        return result;
    },


    cartPage: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-cart`);
        let resources = await this.createModel(`${req.params.brand}-resources`);
        let resultResources = await resources.find({});
        let result = await this.getCartItems(req,res);
        let countCart = await this.countItemsInCart(req,res);

        let output = {
            cartItems: result,
            countCart: countCart,
            resources: resultResources,
            brand: req.params.brand,
            sessionId: req.sessionID,
            email: req.session.person && req.session.person.email.length > 0 ? req.session.person.email : 'false'
        };

        return output;
    },

    countItemsInCart: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-cart`);
        let output = await model.countDocuments({
            $or : [
                {sessionId: req.sessionID},
                {email: req.session.person && req.session.person.email}
            ],
            cartStatus: 'open'
        });
        return output;
    },

    updateCart: async function(req,res) {
        let cart = req.body.cart;
        let model = await this.createModel(`${req.params.brand}-cart`);
        cart =  cart.map( val => {
            val._id = val._id == '' ? new mongoose.mongo.ObjectID() : mongoose.mongo.ObjectID(val._id);
            return val;
        });
        let output = await Promise.all( cart.map( (val, index) => model.findOneAndUpdate( {_id: val._id}, val, { new: true, upsert: true } ) ) ); 
        return {success: 'done', output: output}
    },

    removeItemFromCart: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-cart`);
        let out = await model.deleteOne({_id: req.body.myId});
        return out.deletedCount == 0 ? {status: 300, error: 'item did not remove'} : {success: 'item removed', output: out} ;
    },

    getMongoId: function(req,res) {
        return new mongoose.mongo.ObjectID();
    },

    padWithZeroes: function (number, length) {

        var my_string = '' + number;
        while (my_string.length < length) {
            my_string = '0' + my_string;
        }

        return my_string;

    },

    reviewCartPage: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-resources`);
        let result = await this.getCartItems(req,res);
        let resources = await model.find({});
        let myOrder = await this.findOrderInSession(req,res);
        let countCart = await this.countItemsInCart(req,res);
        let totalCost = result.reduce( (total, val, index) => {
            total = Number(total) + ( Number(val.quantity) * Number(val.items[0].cost) ) ;
            return total;
        },0);
        let output = {
            resources: resources,
            cartItems: result,
            countCart: countCart,
            totalCost: totalCost,
            order: myOrder.order,
            orderNo: this.padWithZeroes(Number(myOrder.orderNo.replace(/^0+/, '')) + 1, 6),
            brand: req.params.brand,
            sessionId: req.sessionID,
            email: req.session.person && req.session.person.email.length > 0 ? req.session.person.email : 'false'
        };
        return output;
    },

    closeCartItems: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-cart`);
        let cartIds = req.body.cartIds.split(' ');
        let output = await Promise.all(cartIds.map(val => model.findOneAndUpdate({_id: val.trim()}, {cartStatus: 'closed'}) ) );
        return 'cartClosed';
    },

    notifySlack: async function(token, msg, conversationId) {
        try {
            const result = await web.chat.postMessage({
                token: token,
                text: msg,
                channel: conversationId,
            });
            return result;
        } catch (e) {
            console.log(e);
            return e
        }
    },

    createOrder: async function(req,res) {
        
        let closeCart = await this.closeCartItems(req,res);

        let order = req.body;
        order._id = order._id == '' ? new mongoose.mongo.ObjectID() : order._id ;
        let model = await this.createModel(`${req.params.brand}-orders`);
        let output = model.findOneAndUpdate({_id: order._id}, order, {upsert: true, new: true});

        model = await this.createModel(`${req.params.brand}-notifications`);
        let notification = new model(
            {
                text: `New order placed — Order No ${order.orderNo}`, 
                status: 'unread',
                type: 'order',
                data: order._id
            });
        await notification.save();

        let notifications = await this.fetchNotifications(req,res)

        io.sockets.emit(`${req.params.brand}newOrder`,notifications);

        let msg = ` ————————\nNew Order \nOrder No : ${order.orderNo} \nCustomer : ${order.name} · ${order.mobile} \nShipping Address : ${order.address} \nOrder Details : <http://${order.myURL}/${req.params.brand}/gen/page/orderReceiptPage/n?mobile=${order.mobile}&orderNo=${order.orderNo}| Show Receipt> \n—————————`;
        
        let resources = await this.fetchResources(req,res);

        let slackNotify = this.notifySlack(resources[0].slackToken, msg, resources[0].slackChannelId);

        return output;
    },

    findOrderInSession: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-orders`);
        let output = await model.findOne({sessionId: req.sessionID}).lean();
        let highestOrder = await model.find({}, {orderNo: 1, _id:0}).sort({orderNo:-1}).limit(1);
        return {order: output, orderNo: highestOrder.length > 0 ? highestOrder[0].orderNo : '000000'};
    },

    findOrderInQuery: async function(req,res) {
        // console.log(chalk.bold.red('finding order by query') );
        let model = await this.createModel(`${req.params.brand}-orders`);
        let output = await model.findOne({
            orderNo: req.query.orderNo,
            mobile: req.query.mobile
        }).lean();
        return {order: output};
    },

    getCartItemsInArray: async function(req, model, cartIds) {
        cartIds = cartIds.split(' ').map( val => mongoose.Types.ObjectId(val) );
        let result = await model
            .aggregate([
            {
                $match: {
                    _id: { $in: cartIds },
                }
            },{
                $addFields:
                {
                    itemId: { $toObjectId: "$itemId" }
                }
            },{
                $lookup:
                 {
                   from: `${req.params.brand}-items`,
                   localField: 'itemId',
                   foreignField: '_id',
                   as: 'items'
                 }
            },{
                $lookup:
                 {
                   from: `${req.params.brand}-items`,
                   localField: 'connectingID',
                   foreignField: 'connectingID',
                   as: 'allSizes'
                 }
            }
            ]);
        return result;
    },

    orderReceiptPage: async function(req,res) {
        let myOrder = await this.findOrderInQuery(req,res);
        let model = await this.createModel(`${req.params.brand}-resources`);
        let resources = await model.find({});
        let countCart = await this.countItemsInCart(req,res);

        if (myOrder.order == null) return {
            resources: resources,
            brand: req.params.brand
        };

        let cartModel = await this.createModel(`${req.params.brand}-cart`);
        let cartIds = myOrder.order.cartIds;
        let result = await this.getCartItemsInArray(req, cartModel, cartIds);
        // let myOrder = await this.findOrderInSession(req,res);
        let totalCost = result.reduce( (total, val, index) => {
            total = Number(total) + ( Number(val.quantity) * Number(val.items[0].cost) ) ;
            return total;
        },0);
        let output = {
            order: myOrder.order,
            cartItems: result,
            countCart: countCart,
            totalCost: totalCost,
            resources: resources,
            brand: req.params.brand,
        };
        return output;
    },

    profile : async function(req,res) {
        return {
            success: true
        };
    },

    profilePage: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-resources`);
        let resources = await model.find({});
        let output = {
            resources: resources,
            brand: req.params.brand,
            sessionId: req.sessionID
        }
        return output;
    },

    findOrderPage: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-resources`);
        let resources = await model.find({});
        let countCart = await this.countItemsInCart(req,res);
        let output = {
            resources: resources,
            countCart: countCart,
            brand: req.params.brand,
            sessionId: req.sessionID
        }
        return output;
    },

    findItemWithId: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-items`);
        let result = await model
            .aggregate([
            {
                $match: {_id: mongoose.Types.ObjectId(req.params.input)}
            },{
                $lookup: 
                {
                    from: `${req.params.brand}-items`,
                    localField: 'connectingID',
                    foreignField: 'connectingID',
                    as: 'allSizes'
                }
            }
            ]);
        return result;
    },

    findMeInCart: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-cart`);
        let result = await model.aggregate([
            {
                $match: {
                    connectingID: req.params.connectingID,
                    sessionId: req.sessionID,
                    cartStatus: 'open'
                }
            },{
                $addFields:
                {
                    itemId: { $toObjectId: "$itemId" }
                }
            },{
                $lookup:
                 {
                   from: `${req.params.brand}-items`,
                   localField: 'itemId',
                   foreignField: '_id',
                   as: 'items'
                 }
            }

        ]);
        return result;
    },

    itemPage: async function(req,res) {
        let item = await this.findItemWithId(req,res);
        let model = await this.createModel(`${req.params.brand}-resources`);
        let resources = await model.find({});
        req.params.connectingID = item[0].connectingID;
        let countCart = await this.countItemsInCart(req,res);
        let itemInCart = await this.findMeInCart(req,res);
        let output = {
            item: item,
            resources: resources,
            countCart: countCart,
            mongoID: new mongoose.mongo.ObjectID(),  
            itemInCart: itemInCart,
            brand: req.params.brand,
            sessionId: req.sessionID
        }
        return output;
    },

    saveItemInCart: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-cart`);
        req.body.sessionId = req.sessionID;
        req.body.email = req.session.hasOwnProperty('person') ? req.session.person.email : 'false';
        let output = await model.findOneAndUpdate({_id: mongoose.Types.ObjectId(req.body.cartId)}, req.body, {upsert: true}).lean();
        return output;
    },

    normalLayout: async function(req,res) {
        let output = await this.showCollection(req,res);
        delete req.query.redirect;
        delete req.query.redirectInput;
        req.params.theme = 'root';
        req.params.module = 'showCollection';
        return output;
    },

    showOrders: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-orders`);
        let orders = await model.find({}).lean();
        let cartModel = await this.createModel(`${req.params.brand}-cart`);
        let ordersWithItems = await Promise.all( orders.map( val => {
            return this.getCartItemsInArray(req, cartModel,val.cartIds);
        }) );

        let finalOrdersOutput = orders.map( (val,index) => {
            return {
                order: val,
                items: ordersWithItems[index],
                totalCost: ordersWithItems[index].reduce( (total, val, index) => {
                    total = Number(total) + ( Number(val.quantity) * Number(val.items[0].cost) ) ;
                    return total;
                },0)
            }
        });

        let collectionsTable = await Collections.find({brand: req.params.brand}).lean();
        let navRows = collectionsTable.map(val => val.name);
        model = await this.createModel(`${req.params.brand}-notifications`);
        let notifications = {
            count: await model.countDocuments({status: 'unread'}),
            texts: await model.find({status: 'unread'})
        };
        return {
            modelName: `${req.params.brand}-orders`,
            notifications: notifications,
            brand: req.params.brand,
            navRows: navRows,
            orders: finalOrdersOutput.filter( val => val.items.length > 0 ),
        }
    },

    updateOrder: async function(req,res) {
        let order = req.body.order;
        let itemStatus;
        if (req.body.quantityTest != 0) {
            itemStatus = await this.orderDelivered(req,res);
        }
        let model = await this.createModel(`${req.params.brand}-orders`);
        let output = await model.findOneAndUpdate({_id: order._id}, {$set: {status: order.status, payment: order.payment}}, {new: true});
        let result = {
            order: output,
            item: itemStatus
        };
        return result;
    },

    orderDelivered: async function(req,res) {
        let items = req.body.items;
        switch (true) {
            case (req.body.quantityTest == -1) :
                items = items.map( val => {
                    val.newQty = Number(val.quantity) - Number(val.quantityDiff);
                    return val;
                });
                break;
            case (req.body.quantityTest == 1) :
                items = items.map( val => {
                    val.newQty = Number(val.quantity) + Number(val.quantityDiff);
                    return val;
                });
                break;
            default: 
                return 0;
                break;
        };
        let model = await this.createModel(`${req.params.brand}-items`);
        let output = await Promise.all( items.map(val => model.findOneAndUpdate({_id: mongoose.Types.ObjectId(val.itemId)}, {$set: {quantity: val.newQty}}, {new: true}).lean() ) );
        return output;
    },

    getSizes: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-sizes`);
        let output = await model.find({category: req.params.input}).lean();
        output = output.map( size => {
            Object.values(size).forEach( data => {
                Object.keys(data).forEach(k => data[k] == '' || k == '_id' || k == 'category' ?  delete data[k] : data[k]);
                data['size'] = data['name'];
                delete data['name'];
            });
            return size;
        })
        return output;
    },

    showPage: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-pages`);
        let output = await model.findOne({slug: req.params.input}).lean();
        model = await this.createModel(`${req.params.brand}-resources`);
        let resources = await model.find({});
        let countCart = await this.countItemsInCart(req,res);
        return {
            resources: resources,
            countCart: countCart,
            brand: req.params.brand,
            page: output,
            brand: req.params.brand,
        };
    },

    editPage: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-pages`);
        let page = await model.findOne({_id: req.params.input}).lean();
        return {
            page: page,
            brand: req.params.brand,
            resources: await this.fetchResources(req,res),
            modelName: `${req.params.brand}-pages`
        };
    },

    updatePage: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-pages`);
        let output = await model.findOneAndUpdate({_id:req.params.input},{$set: {content: req.body.output}},{new:true}).lean();
        return output;
    },

    clearNotification: async function(req,res) {

        let model = await this.createModel(`${req.params.brand}-notifications`);
        let output = await model.findOneAndUpdate({_id: req.params.input},
            {
                $set : {
                    status: 'read'
                }
            },
            {
                new: true
            }
        );

        return output;

    },

    fetchNotifications: async function(req,res) {

        let model = await this.createModel(`${req.params.brand}-notifications`);
        let notifications = {
            count: await model.countDocuments({status: 'unread'}),
            texts: await model.aggregate([
                {
                    $match: {
                        status: 'unread'
                    }
                },
                {
                    $addFields: {
                        created_at: { $dateToString: { format: "%Y-%m-%d · %H:%M", date: "$created_at" } },
                    }
                },
                {
                    $sort : {
                        created_at: -1
                    }
                }
            ])
        };

        return notifications;
    },

    dashboard: async function(req,res) {
        let date = new Date();

        let query = {
            created_at : {
                $gte: new Date(date.getFullYear(), date.getMonth(), 1),
                $lt : new Date()
            },
            payment: {
                $in: [ "Paid (COD)", "Paid (Online Transfer)"]
            }
        };

        req.query.sort = { created_at: -1 };

        let output = await this.fetchOrders(req,query);

        let models = {
            items : await this.createModel(`${req.params.brand}-items`),
            orders : await this.createModel(`${req.params.brand}-orders`),
            users : await this.createModel(`${req.params.brand}-users`),
            pages : await this.createModel(`${req.params.brand}-pages`),
            sizes: await this.createModel(`${req.params.brand}-sizes`)
        }

        let counts = {
            netRevenue : output.reduce( (total,val) => total = total + val.netRevenue , 0 ),
            outOfStock : await models.items.find({quantity:0}).countDocuments(),
            unhandledOrders : await models.orders.find({status: "Order Placed in Store"}).countDocuments(),
            allOrders : await models.orders.find().countDocuments(),
            allProducts: await models.items.find().countDocuments(),
            allEmployees : await models.users.find().countDocuments(),
            staticPages: await models.pages.find().countDocuments(),
            allSizes: await models.sizes.find().countDocuments()
        };

        return {
            resources: await this.fetchResources(req,res),
            brand: req.params.brand,
            notifications: await this.fetchNotifications(req,res),
            counts: counts
        };
    },

    calcProfits: async function(req,from,to) {
        let model = await this.createModel(`${req.params.brand}-orders`);
        var date = new Date();
        let output = await model.aggregate([
            {
                $match: {
                    created_at : {
                        $gte: req.query.from && new Date(req.query.from) || new Date(date.getFullYear(), date.getMonth(), 1),
                        $lt : req.query.to && new Date(req.query.to) || new Date()
                    }
                }
            },{
                $addFields: {
                    cartIds : {
                       $split : [ '$cartIds' , " " ]
                     }
                }
            },{
                $unwind: "$cartIds"
            },{
                $addFields : {
                    cartIds : {
                       $toObjectId : "$cartIds"
                    }
                }
            },{
                $lookup : {
                    from : `${req.params.brand}-carts`,
                    localField : "cartIds",
                    foreignField : "_id",
                    as : "carts"
                }
            },{
                $project : {
                    orderNo : 1,
                    mobile : 1,
                    created_at: 1,
                    itemQuantity : {
                        $arrayElemAt : [ "$carts.quantity" , 0 ]
                    },
                    itemId : {
                        $arrayElemAt : [ "$carts.itemId" , 0 ]
                    }
                }
            },{
                $addFields : {
                    itemId : {
                        $toObjectId : "$itemId"
                    }
                }
            },{
                $lookup : {
                    from : `${req.params.brand}-items`,
                    localField : "itemId",
                    foreignField : "_id",
                    as : "item"
                }
            },{
                $addFields : {
                    item : {
                        $arrayElemAt : [ "$item.name" , 0 ]
                    },
                    itemQuantity : {
                        $toInt : "$itemQuantity"
                    },
                    purchaseCost : {
                        $toInt : {
                            $arrayElemAt : [ "$item.purchase" , 0 ]
                        }
                    },
                    sellCost : {
                        $toInt : {
                            $arrayElemAt : [ "$item.cost" , 0 ]
                        }
                    }
                }
            },{
                $group : {
                    _id : {
                        orderNo : "$orderNo",
                        mobile : "$mobile",
                        created_at : "$created_at"
                    },
                    purchaseCost: { $sum: { $multiply: [ "$purchaseCost", "$itemQuantity" ] } },
                    sellCost: { $sum: { $multiply: [ "$sellCost", "$itemQuantity" ] } }
                }
            },{
                $project : {
                    _id : 0,
                    orderNo : "$_id.orderNo",
                    mobile : "$_id.mobile",
                    created_at: { $dateToString: { format: "%Y-%m-%d", date: "$_id.created_at" } },
                    purchaseCost : 1,
                    sellCost : 1,
                    netRevenue : {
                        $subtract : [ "$sellCost" , "$purchaseCost" ]
                    }
                }
            }
        ]);

        let grossResult = {
            totalOrders : output.reduce( (total,val) => total = total + 1 , 0 ),
            purchaseCost : output.reduce( (total,val) => total = total + val.purchaseCost , 0 ),
            sellCost : output.reduce( (total,val) => total = total + val.sellCost , 0 ),
            netRevenue : output.reduce( (total,val) => total = total + val.netRevenue , 0 )
        };
        let result = {
            orders : output,
            gross : grossResult
        }
        return result;
    },

    sendSlackMsg: async function(req, res, token, channelId) {

        token = token || req.query.token;
        channelId = channelId || req.query.channelId;
        let result;
        try {
            result = await web.chat.postMessage({
                token : token, 
                text: `Great ! Your Slack channel is working. — ${req.params.brand}`,
                channel: channelId,
            });
            return {result}
        } catch(e) {
            return {status: 400, error: e.data.error}
        }
    },

    // pjax modules

    profits: async function(req,res) {
        var date = new Date();
        let from = req.query.from && new Date(req.query.from).setHours(00,00,00) || new Date(date.getFullYear(), date.getMonth(), 1).setHours(00,00,00); 
        let to = req.query.to && new Date(req.query.to).setHours(23,59,59) || new Date().setHours(23,59,59);
        let query = {
            created_at : {
                $gte: req.query.from && new Date(req.query.from) || new Date(date.getFullYear(), date.getMonth(), 1),
                $lt : req.query.to && new Date(req.query.to) || new Date()
            },
            payment: {
                $in: [ "Paid (COD)", "Paid (Online Transfer)"]
            }
        };

        req.query = processQuery(req.query);

        let output = await this.fetchOrders(req,query);

        let grossResult = {
            totalOrders : output.reduce( (total,val) => total = total + 1 , 0 ),
            purchaseCost : output.reduce( (total,val) => total = total + val.orderPurchasePrice, 0 ),
            sellCost : output.reduce( (total,val) => total = total + val.orderSellPrice , 0 ),
            netRevenue : output.reduce( (total,val) => total = total + val.netRevenue , 0 )
        };
        return {
            orders: output,
            gross : grossResult,
            fromDate: new Date(from).toISOString().substr(0, 10),
            toDate: new Date(to).toISOString().substr(0, 10),
            brand: req.params.brand,
        };
    },

    outOfStock: async function(req,res) {
        console.log( chalk.bold.blue('Items out of stock') );

        var query = processQuery(req.query);
        delete query.filter._pjax;

        let model = await this.createModel(`${req.params.brand}-items`);
        let output = await model.aggregate([
            {
                $match: {
                    quantity: "0"
                } 
            },{
                $addFields: {
                    updatedAt: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    quantity: { $toInt : "$quantity" },
                    cost : { $toInt: "$cost" },
                    purchase : {$toInt : "$purchase" },
                }
            },{
                $addFields : {
                    profit : { $subtract : [ "$cost" , "$purchase" ] }
                }
            },{
                $sort: query.sort
            }
        ]);

        return {
            items: output,
            brand: req.params.brand
        }

    },

    fetchOrders: async function(req,query) {
        let model = await this.createModel(`${req.params.brand}-orders`);
        let orders = await model.aggregate([
            {
                $match: query
            },{
                $addFields: {
                    cartIds: {
                        $split: [ "$cartIds", " " ]
                    }
                }
            },{
                $addFields: {
                    cartIds : {
                        $map : {
                            input : "$cartIds",
                            as : "cartIds",
                            in : {
                                $toObjectId : "$$cartIds"
                            }
                        }
                    }
                }
            },{
                $lookup : {
                    from : `${req.params.brand}-carts`,
                    localField : "cartIds",
                    foreignField : "_id",
                    as : "carts"
                }
            },{
                $unwind : "$carts"
            },{
                $addFields : {
                    itemId : {
                        $toObjectId : "$carts.itemId"
                    }
                }
            },{
                $lookup : {
                    from : `${req.params.brand}-items`,
                    localField : "itemId",
                    foreignField : "_id",
                    as : "item"
                }
            },{
                $addFields : {
                    "carts.item" : {
                        $arrayElemAt : [ "$item" , 0 ]
                    },
                    cartQuantity : {
                        $toInt : "$carts.quantity"
                    },
                    sellCost : {
                        $toInt : {
                            $arrayElemAt : [ "$item.cost" , 0 ]
                        }
                    },
                    purchaseCost : {
                        $toInt : {
                            $arrayElemAt : [ "$item.purchase", 0]
                        }
                    }
                }
            },{
                $addFields : {
                    "carts.totalCost" : {
                        $multiply : [ "$sellCost" , "$cartQuantity" ]
                    }
                }
            },{
                $group : {
                    _id: {
                        _id: "$_id",
                        orderNo : "$orderNo",
                        mobile: "$mobile",
                        name: "$name",
                        address: "$address",
                        created_at: "$created_at",
                        status: "$status",
                        payment: "$payment",
                    },
                    cart : {
                        $addToSet : "$carts"
                    },
                    orderSellPrice: {
                        $sum : {
                            $multiply : [ "$cartQuantity" , "$sellCost" ]
                        }
                    },
                    orderPurchasePrice: {
                        $sum : {
                            $multiply : [ "$cartQuantity" , "$purchaseCost" ]
                        }
                    }
                }
            },{
                $project : {
                    _id: 0,
                    _id: "$_id._id",
                    orderNo : "$_id.orderNo",
                    mobile : "$_id.mobile",
                    name : "$_id.name",
                    address: "$_id.address",
                    status: "$_id.status",
                    payment: "$_id.payment",
                    cart : "$cart",
                    created_at: { $dateToString: { format: "%Y-%m-%d", date: "$_id.created_at" } },
                    orderSellPrice : 1,
                    orderPurchasePrice : 1,
                    netRevenue : { $subtract : [ "$orderSellPrice" , "$orderPurchasePrice" ] }
                }
            },{
                $sort : req.query.sort
            }
         ]);
        return orders;
    },

    unhandledOrders: async function(req,res) {

        req.query = processQuery(req.query);
        delete req.query.filter._pjax;

        req.query.filter.status = 'Order Placed in Store';

        let orders = await this.fetchOrders(req,req.query.filter);

        return {

            brand: req.params.brand,
            orders: orders
        }

    },

    updateOrderStatuses: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-orders`);

        let output = await model.findOneAndUpdate(
            { 
                _id : req.body.myId
            },{ 
                $set : { 
                    status: req.body.orderStatus,
                    payment: req.body.paymentStatus,
                }
            },{
                new: true
            }
        );

        return output;
    },

    allOrders: async function(req,res) {

        var date = new Date();
        let from = req.query.from && new Date(req.query.from).setHours(00,00,00) || new Date(date.getFullYear(), date.getMonth(), 1).setHours(00,00,00); 
        let to = req.query.to && new Date(req.query.to).setHours(23,59,59) || new Date().setHours(23,59,59);

        req.query = processQuery(req.query);
        delete req.query.filter._pjax;
        delete req.query.filter.to;
        delete req.query.filter.from;

        query = Object.values(req.query.filter).length > 0 ? req.query.filter :  {};
        let output = await this.fetchOrders(req,query);

        return {
            orders: output,
            fromDate: new Date(from).toISOString().substr(0, 10),
            toDate: new Date(to).toISOString().substr(0, 10),
            filterApplied: Object.values(req.query.filter).length > 0,
            count: output.length,
            brand: req.params.brand,
        };
    },

    allProducts : async function(req,res) {

        var query = processQuery(req.query);
        delete query.filter._pjax;

        let model = await this.createModel(`${req.params.brand}-items`);
        let output = await model.aggregate([
            {
                $match: query.filter 
            },{
                $addFields: {
                    updatedAt: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    quantity: { $toInt : "$quantity" },
                    cost : { $toInt: "$cost" },
                    purchase : {$toInt : "$purchase" },
                }
            },{
                $addFields : {
                    profit : { $subtract : [ "$cost" , "$purchase" ] }
                }
            },{
                $sort: query.sort
            }
        ]);

        return {
            items: output,
            filterApplied: Object.values(query.filter).length > 0,
            count: output.length,
            brand: req.params.brand
        }

    },

    allSizes : async function(req,res) {
        var query = processQuery(req.query);
        delete query.filter._pjax;
        let model = await this.createModel(`${req.params.brand}-sizes`);
        let sizes = await model.aggregate([
            {
                $match: query.filter
            }, {
                $sort: query.sort
            }
        ]);

        return {
            brand: req.params.brand,
            sizes: sizes,
            count: sizes.length
        }
    },

    allEmployees: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-users`);
        var query = processQuery(req.query);
        delete query.filter._pjax;

        let output = await model.aggregate([
            {
                $match: query.filter 
            },{
                $addFields: {
                    updatedAt: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                }
            },{
                $sort: {
                    updatedAt: -1
                }
            }
        ]);
        return {
            users: output,
            brand: req.params.brand
        }
    },

    branding: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-resources`);
        let output = await model.aggregate([
            {
                $match: {}
            },{
                $addFields: {
                    logo : {
                        $split: [ "$logo" , " " ]
                    }
                }
            }
        ]);

        return {
            resources: output,
            brand: req.params.brand,
        }
    },

    updateResources: async function(req,res) {

        console.log({body: req.body});
        let model = await this.createModel(`${req.params.brand}-resources`);
        let output = await model.findOneAndUpdate(
            {
                brandName: req.params.brand
            },{
                $set: {
                    logo: req.body.logo,
                    twitter: req.body.twitter,
                    facebook: req.body.facebook,
                    insta: req.body.insta,
                    youtube: req.body.youtube,
                    scripts: req.body.scripts,
                    email: req.body.email,
                    mobile: req.body.mobile,
                    slackToken: req.body.slackToken,
                    slackChannelId: req.body.slackChannelId,
                    address: req.body.address,
                    slogan: req.body.slogan
                }
            },{
                new: true
            }
        );

        console.log({output});
        return output;
    },

    showPages: async function(req,res) {
        let model = await this.createModel(`${req.params.brand}-pages`);
        var query = processQuery(req.query);
        delete query.filter._pjax;
        let pages = await model.aggregate([
            {
                $match: query.filter
            },{
                $addFields: {
                    content : {
                        $substr : [ "$content" , 0 , 300 ]
                    },
                    updatedAt: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                }
            }
        ]);
        let collectionsTable = await Collections.find({brand: req.params.brand}).lean();
        let navRows = collectionsTable.map(val => val.name);
        model = await this.createModel(`${req.params.brand}-notifications`);
        let notifications = {
            count: await model.countDocuments({status: 'unread'}),
            texts: await model.find({status: 'unread'})
        };
        return {
            pages: pages,
            modelName: `${req.params.brand}-pages`,
            notifications: notifications,
            brand: req.params.brand,
            navRows: navRows,
            filterApplied: Object.values(query.filter).length > 0,
        }
    },

    createIndexedModel : async function(modelName) {

        let modelExistsAlready = Object.keys(mongoose.models).some(val => val == modelName);
        if (modelExistsAlready) { mongoose.models[modelName] = ''; };

        let collection = await Collections.findOne({name: modelName}).lean();
        let schema = new mongoose.Schema(collection.properties);

        switch (true) {
            case (/orders/.test(modelName)) : 
                schema.index = { orderNo: "text", address: "text", mobile: "text", name: "text", status: "text", payment: "text" };
                break;
            case (/items/.test(modelName)) :
                schema.index = { name: "text", purchase: "text", cost: "text", size: "text", school: "text", house: "text", details: "text", category: "text" };
                break;
            case (/users/.test(modelName)) : 
                schema.index = { name: "text", email: "text", role: "text"};
                break;
            case (/resources/.test(modelName)) :
                schema.index = { brandName: "text", twitter: "text", facebook: "text", youtube: "text", insta: "text", scripts: "text" };
                break;
        };

        return mongoose.model(modelName, schema);

    },

    searchDashboard: async function(req,res) {

        let models = {
            orders: await this.createModel(`${req.params.brand}-orders`),
            items: await this.createModel(`${req.params.brand}-items`),
            users: await this.createModel(`${req.params.brand}-users`),
            resources: await this.createModel(`${req.params.brand}-resources`),
            pages: await this.createModel(`${req.params.brand}-pages`),
        };

        let keyWord = new RegExp(req.body.text, 'i');

        let output = {
            orders: await models.orders.find(
                { 
                    $or : [ 
                        {
                            orderNo: keyWord
                        }, {
                            address: keyWord
                        }, {
                            mobile: keyWord
                        }, {
                            name: keyWord
                        }  
                    ] 
                },{
                    _id: 0,
                    cartIds: 0,
                    created_at: 0,
                    __v: 0,
                    updatedAt: 0,
                    sessionId: 0,
                }).limit(4),
            items: await models.items.find(
                { 
                    $or : [ 
                        {
                            name: keyWord
                        }, {
                            purchase: keyWord
                        }, {
                            cost: keyWord
                        }, {
                            size: keyWord
                        }, {
                            school: keyWord
                        }, {
                            house: keyWord
                        }, {
                            details: keyWord
                        }, {
                            category: keyWord
                        } 
                    ] 
                },{
                    name: 1,
                    purchase: 1,
                    cost: 1,
                    size: 1,
                    school: 1,
                    house: 1,
                    details: 1,
                    category: 1
                }).limit(4),
            users: await models.users.find(
                { 
                    $or : [ 
                        {
                            name: keyWord
                        }, {
                            email: keyWord
                        }, {
                            role: keyWord
                        } 
                    ] 
                },{
                    _id: 0,
                    name: 1,
                    email: 1,
                    role: 1
                }).limit(4),
            resources: await models.resources.find(
                { 
                    $or : [ 
                        {
                            brandName: keyWord
                        }, {
                            twitter: keyWord
                        }, {
                            facebook: keyWord
                        }, {
                            youtube: keyWord
                        }, {
                            insta: keyWord
                        }
                    ] 
                },{
                    _id: 0,
                    brandName: 1,
                    twitter: 1,
                    facebook: 1,
                    youtube: 1,
                    insta: 1
                }).limit(4),
            pages: await models.pages.aggregate([
                {
                    $match : {
                    $or : [
                        {
                            para: keyWord
                        }, {
                            page: keyWord
                        }, {
                            content: keyWord
                        }
                    ]
                    }
                },{
                    $addFields: {
                        content : {
                            $substr : [ "$content" , 0 , 100 ]
                        },
                        updatedAt: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
                    }
                }
            ]).limit(4)
        }

        io.sockets.emit('newOrder', 12);

        return output;
    },

    // Create backup of app
    
    createAppBackup : async function(req,res) {

        // store all collections inside a separate file

        let names = await Collections.find({},{name:1});

        let models  = await Promise.all( names.map( val => this.createModel(val.name) ) ); 

        let outputs = await Promise.all( models.map( (val,index) => val.find({}) ) );

        outputs = outputs.map( (val,index) => {
            return {
                name: names[index].name,
                data: val
            }
        });

        let file = await fs.writeFile(
            './static/backup.json', 
            JSON.stringify( outputs, 0 , 2 ) , 
            (err) => {
                if (err) {
                  return 'Failed to backup';
                }
                return 'Successful';
            });

        return {success: "done"};

    },

    loadBackUp : async function(req,res) {

        let file = await new Promise( (resolve, reject) => {

            fs.readFile('./static/backup.json', 'utf8', (err, data) => {
                if (err) reject(err)
                resolve( JSON.parse(data) );
            });

        }); 

        // first load collections from the file
        let collectionFile = file.filter( val => val.name === 'collections' )[0];

        try { let collectionDrop = await mongoose.connection.db.dropCollection('collections'); } 
        catch (e) { console.log(e) }

        let collectionSave = await Collections.insertMany( collectionFile.data );
        
        let models = await Promise.all( file.map( val => this.createModel(val.name) ) );

        let funcs = [];
        models.forEach( (val,index) => {
            file[index].data.forEach( (data) => {
                funcs.push({
                    model: val,
                    data: data
                })
            })
        });

        let emptyAllCollections = await Promise.all( funcs.map( val => val.model.deleteMany({}) ) );
        let outputs = await Promise.all( funcs.map( val => val.model.findOneAndUpdate({_id: val.data._id}, val.data, {upsert: true}) ) );

        return {success: true};

    },

    challenges: async function(req,res) {
        return {
            sessionExists: true
        };
    },

    openChallenge: async function(req,res) {
        // if user has this challenge in selected list than fine else route to payment page and welcome screen
          let box = [];
          for (var i = 1; i < 31; i++) {
            switch (true) {
              case i == 1:
                box.push({
                  number: i,
                  past: 'true',
                  locked: 'true',
                  logged: 'true',
                  feelingType: 1,
                  feeling: '/emojis/depressed.svg',
                  comments: 'I am feeling kind of happy today. Let`s see till what point can I get moving'
                })
                break;
              case i == 2:
                box.push({
                  number: i,
                  past: 'true',
                  locked: 'true',
                  logged: 'true',
                  feelingType: 2,
                  feeling: '/emojis/exhausted.svg',
                  comments: 'I am feeling kind of happy today. Let`s see till what point can I get moving'
                })
                break;
              case i == 3:
                box.push({
                  number: i,
                  past: 'true',
                  locked: 'true',
                  logged: 'true',
                  feelingType: 3,
                  feeling: '/emojis/bored.svg',
                  comments: 'I am feeling kind of happy today. Let`s see till what point can I get moving'
                })
                break;
              case i == 4:
                box.push({
                  number: i,
                  past: 'true',
                  locked: 'true',
                  logged: 'true',
                  feelingType: 4,
                  feeling: '/emojis/happy.svg',
                  comments: 'I am feeling kind of happy today. Let`s see till what point can I get moving'
                })
                break;
              case i == 5:
                box.push({
                  number: i,
                  past: 'true',
                  locked: 'true',
                  logged: 'true',
                  feelingType: 5,
                  feeling: '/emojis/flow.svg',
                  comments: 'I am feeling kind of happy today. Let`s see till what point can I get moving'
                })
                break;
              case i == 6:
                box.push({
                  number: i,
                  present: 'true',
                  locked:'false'
                })
                break;
              default:
                box.push({
                  number: i,
                  future: 'true',
                  locked:'true'
                });
            }

          }
        return {
            box: box
        }
    },

    dashboardBlogs: async function(req,res) {
        req.params.input = 'life-blogs';
        req.isLocal = true;
        let output = await this.showCollection(req,res);
        req.params.theme = 'life';
        console.log(output);
        return output;
    },

    addNewBlog: async function(req,res) {
        return {
            blog: {
                _id: this.getMongoId(req,res),
            }
        };
    },

    editThisBlog: async function(req,res) {
        req.params.module = "addNewBlog";
        console.log(req.query);
        let model = await this.createModel(req.params.input);
        let output = await model.findOne({_id: req.query._id}).lean();
        output.date = this.getFormattedDate(output.date);
        console.log(output);
        return {
            blog: output
        };
    },

    saveBlog: async function(req,res) {
        let model = await this.createModel('life-blogs');
        let myId = req.query._id;
        delete req.query._id;
        let output = await model.findOneAndUpdate({
            _id: myId 
        },
            req.query
        ,{
            upsert: true
        });
        return {
            success: true
        }
    },

    publishBlog: async function(req,res) {
        console.log(req.body);
        let model = await this.createModel('life-blogs');
        let output = await model.findOneAndUpdate({
            _id: req.body._id
        },{
            publish: req.body.publish
        });
        return output;
    },

    getFormattedDate : function(inputDate) {
        var date = new Date(inputDate);
        return date.getFullYear() + '-' + ((date.getMonth() > 8) ? (date.getMonth() + 1) : ('0' + (date.getMonth() + 1))) + '-' + ((date.getDate() > 9) ? date.getDate() : ('0' + date.getDate())); 
    },

    openBlog: async function(req,res) {
        let model = await this.createModel('life-blogs');
        let output = await model.findOne({slug: req.params.input});
        let body = output.body.split('\n').map(val => {
            return {
              type: val.split(': ')[0].indexOf('.') != -1 ? val.split(': ')[0].split('.')[0] : val.split(': ')[0],
              msg: val.split(': ')[1].trim(),
              class: val.split(': ')[0].indexOf('.') != -1 ? val.split(': ')[0].split('.').slice(1,4).join(' ') : ''
            }
          });
        let d = new Date(output.date);
        let ye = new Intl.DateTimeFormat('en', { year: 'numeric' }).format(d);
        let mo = new Intl.DateTimeFormat('en', { month: 'short' }).format(d);
        let da = new Intl.DateTimeFormat('en', { day: '2-digit' }).format(d);
        output.date = `${da} ${mo}, ${ye}`;
        return {
            output: output,
            body: body,
            tags: output.tags.split(',')
        };
    },

    subscribeCustomer: async function(req,res) {

        console.log(req.body);
        let model = await this.createModel(`${req.params.brand}-subscribers`);
        let output = await model.findOneAndUpdate({email: req.body.email},{email: req.body.email, validation: false}, {upsert: true});
        return {
            output
        }

    },

};

server.listen(3000)
