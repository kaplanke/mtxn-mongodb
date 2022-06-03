import { Mongoose, ClientSession, ClientSessionOptions } from "mongoose";
import log4js from "log4js";
import { Context, MultiTxnMngr, Task } from "multiple-transaction-manager";
import { v1 } from "uuid";

class MongoContext implements Context {

    mongoose: Mongoose;
    clientSessionOptions: ClientSessionOptions | undefined;
    txn: ClientSession | undefined = undefined;
    contextId: string;
    logger = log4js.getLogger("MultiTxnMngr");

    constructor(mongoose: Mongoose, options?: ClientSessionOptions) {
        this.mongoose = mongoose;
        this.clientSessionOptions = options;
        this.contextId = v1();
    }

    init(): Promise<Context> {
        return new Promise((resolve, reject) => {
            if (this.isInitialized()) {
                reject("Context already initialised.");
            } else {
                this.mongoose.startSession(this.clientSessionOptions).then((value) => {
                    try {
                        this.txn = value;
                        this.txn.startTransaction();
                        resolve(this);
                    } catch (err) {
                        reject(err);
                    }
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    commit(txnMngr: MultiTxnMngr): Promise<Context> {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized()) {
                reject("Cannot commit. Context not initialised.");
            } else {
                this.txn?.commitTransaction().then(ret => {
                    this.txn?.endSession().then((value) => {
                        resolve(this);
                    }).catch((err) => {
                        reject(err);
                    }).finally(() => {
                        this.txn = undefined;
                    });
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    rollback(): Promise<Context> {
        return new Promise((resolve, reject) => {
            if (!this.isInitialized()) {
                reject("Cannot rollback. Context not initialised.");
            } else {
                this.txn?.abortTransaction().then((ret) => {
                    this.txn?.endSession().then((value) => {
                        resolve(this);
                    }).catch((err) => {
                        reject(err);
                    }).finally(() => {
                        this.txn = undefined;
                    });
                }).catch((err) => {
                    reject(err);
                });
            }
        });
    }

    isInitialized(): boolean {
        return this.txn != undefined;
    }

    getName(): string {
        return "Redis Context: " + this.contextId;
    }

    getTransaction(): ClientSession {
        if (!this.txn)
            throw new Error("Transaction not initialised!");
        return this.txn;
    }

    addFunctionTask(txnMngr: MultiTxnMngr,
        execFunc: (mongoose: Mongoose, txn: ClientSession, task: Task) => Promise<any>) {
        const task = new MongoTask(this, execFunc);
        txnMngr.addTask(task);
    }
}

class MongoTask implements Task {

    context: MongoContext;
    rs: any | undefined;
    execFunc: (mongoose: Mongoose, txn: ClientSession, task: Task) => Promise<any>;

    constructor(context: MongoContext,
        execFunc: (mongoose: Mongoose, txn: ClientSession, task: Task) => Promise<any>) {
        this.context = context;
        this.execFunc = execFunc;
    }

    getContext(): MongoContext {
        return this.context;
    }

    exec(): Promise<Task> {
        return new Promise<Task>((resolveTask, rejectTask) => {
            this.execFunc(this.getContext().mongoose, this.getContext().getTransaction(), this).then((res) => {
                this.rs = res;
                resolveTask(this);
            }).catch((err) => {
                rejectTask(err);
            });
        });
    }

    getResult(): any | undefined {
        return this.rs;
    }

    params: any;
    setParams(params: object) {
        throw new Error("Method not implemented.");
    }
}

export { MongoContext, MongoTask };

