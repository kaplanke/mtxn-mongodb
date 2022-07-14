# @multiple-transaction-manager/mongodb

> MongoDB context implementation for multiple-transaction-manager library. 

## API

### Classes

#### __MongoContext__

####  `constructor(txnMngr, mongoose, options)`
-   `txnMngr`: _{MultiTxnMngr}_ The multiple transaction manager to to bind with the context.
-   `mongoose`: _{Mongoose}_ The mongoose instance to obtain the session from.
-   `options`: _{ClientSessionOptions}_ The mongoose session options.
-   Returns: {MongoContext} The created _MongoContext_ instance.

#### `addFunctionTask(execFunc)`

Adds a task to the transaction manager.

-   `execFunc`: _{execFunc: (mongoose: Mongoose, txn: ClientSession, task: Task) => Promise\<unknown>}_ The function to be executes in promise. Mongoose instance and current transaction handle are provided to the function.
-   Returns: {MongoTask} The created _MongoTask_ instance.


#### __MongoTask__

####  `constructor(context, execFunc)`
-   `context`: _{MongoContext}_ The _MongoContext_ to to bind with the task.
-   `execFunc`: _{execFunc: (mongoose: Mongoose, txn: ClientSession, task: Task) => Promise\<unknown>}_ The function to be executes in promise. Mongoose instance and current transaction handle are provided to the function.
-   Returns: {MongoTask} The created _MongoTask_ instance.

## Example

https://github.com/kaplanke/mtxn-mongodb/blob/master/test/mtxn.mongo.test.ts


```js
    // init manager & context
    const txnMngr: MultiTxnMngr = new MultiTxnMngr();
    const mongoContext = new MongoContext(txnMngr, theMongoose);

    // Add first step
    mongoContext.addFunctionTask((_mongoose, txn, _task) => studentModel.create([{ sid: 1, "name": "Kevin" }], { session: txn }));

    // Add second step
    mongoContext.addFunctionTask((_mongoose, txn, _task) => studentModel.create([{ sid: 2, "name": "Stuart" }], { session: txn }));

    // Uncomment next line if you want to test rollback scenario 
    // mongoContext.addFunctionTask(txnMngr, (mongoose, txn, task) => studentModel.create([{ sid: 2, "name": "Bob" }], { session: txn }));

    // Add control step
    const controlTask = mongoContext.addFunctionTask((_mongoose, txn, _task) => studentModel.findOne({ sid: 1 }).session(txn).exec());

    await txnMngr.exec();

    //jest
    expect(controlTask.getResult().name).toEqual("Kevin");
```