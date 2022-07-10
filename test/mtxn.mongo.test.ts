import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import log4js from "log4js";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Model, Mongoose, Schema } from "mongoose";
import { MultiTxnMngr } from "multiple-transaction-manager";
import { MongoContext } from "../src/index";

log4js.configure({
    appenders: { 'out': { type: 'stdout' } },
    categories: { default: { appenders: ['out'], level: 'debug' } }
});

let theMongoose: Mongoose;
let studentModel: Model<unknown>;
let mongoServer: MongoMemoryReplSet;

jest.setTimeout(30000);
describe("Multiple transaction manager Mongo workflow test...", () => {

    beforeAll(async () => {
        global.console = require('console');
        mongoServer = await MongoMemoryReplSet.create({ replSet: { count: 4 } });
        const mongoServerUri = mongoServer.getUri();
        theMongoose = await mongoose.connect(mongoServerUri);
        studentModel = theMongoose.model(
            'Student',
            new Schema({
                sid: {
                    type: Number,
                    unique: true
                },
                name: String
            })
        ) as Model<unknown>;
        await studentModel.createIndexes();
    });

    test("Function task example", async () => {
        // init manager
        const txnMngr: MultiTxnMngr = new MultiTxnMngr();

        const mongoContext = new MongoContext(theMongoose);

        // Add first step
        mongoContext.addFunctionTask(txnMngr, (_mongoose, txn, _task) => studentModel.create([{ sid: 1, "name": "Kevin" }], { session: txn }));

        // Add second step
        mongoContext.addFunctionTask(txnMngr, (_mongoose, txn, _task) => studentModel.create([{ sid: 2, "name": "Stuart" }], { session: txn }));

        // Uncomment next line if you want to test rollback scenario 
        // mongoContext.addFunctionTask(txnMngr, (mongoose, txn, task) => studentModel.create([{ sid: 2, "name": "Bob" }], { session: txn }));

        // Add control step
        const controlTask = mongoContext.addFunctionTask(txnMngr, (_mongoose, txn, _task) => studentModel.findOne({ sid: 1 }).session(txn).exec());

        await txnMngr.exec();
        expect(controlTask.getResult().name).toEqual("Kevin");

    });

    afterAll(async () => {
        await theMongoose.disconnect();
        await mongoServer.stop();
    });

});