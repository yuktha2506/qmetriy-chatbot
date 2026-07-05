import mongoose from 'mongoose';
class ConnectionManager {
    static instance = null;

    constructor() {
        this.connections = {}; // Stores tenant DB connections
        this.metaConnection = null; // Stores metadata DB connection
        // this.certPath = '/home/aravind_p/mongodb/global-bundle.pem';
    }

    static getInstance() {
        if (!ConnectionManager.instance) {
            ConnectionManager.instance = new ConnectionManager();
        }
        return ConnectionManager.instance;
    }

    /** Connects to the shared MetaDB */
    connectToMetaDB() {
        if (!process.env.TENANT_DB) {
            console.error('TENANT_DB environment variable is not defined!');
            return;
        }
        //const uri = `${process.env.TENANT_DB}/QMetrixMetaDB?directConnection=true&tls=true&retryWrites=false`;
        const uri = `${process.env.TENANT_DB}/QMetrixMetaDB`;
        console.log('Attempting to connect to Meta DB with URI:', uri);

        if (!this.metaConnection) {
            console.log('Creating new Meta DB connection...');
            this.metaConnection = mongoose.createConnection(uri, {
                minPoolSize: 1,
                maxPoolSize: 5,
                maxIdleTimeMS: 60000,
                useNewUrlParser: true, // Ensure to use the new URL parser
                useUnifiedTopology: true, // Use the new unified topology
                // directConnection: true,
                // tls: true,
                // tlsCAFile: this.certPath,
                // tlsAllowInvalidHostnames: true,
                // tlsAllowInvalidCertificates: true,
                // retryWrites: false,
                // authMechanism: 'SCRAM-SHA-1',
                // authSource: 'admin',
                // ssl: true, // Ensure SSL is enabled
                // replicaSet: 'rs0', // Amazon DocumentDB requires replica set
            });

            this.metaConnection.on('connecting', () => {
                console.log('Meta DB: Attempting to connect...');
            });

            this.metaConnection.on('connected', () => {
                console.log('Meta DB: Successfully connected');
            });

            this.metaConnection.on('disconnected', () => {
                console.log('Meta DB: Disconnected');
            });

            this.metaConnection.on('error', (err) => {
                console.error('Meta DB connection error:', err);
                console.error('Connection URI:', uri);
                console.error('Connection options:', {
                    minPoolSize: 1,
                    maxPoolSize: 5,
                    maxIdleTimeMS: 60000,
                    useNewUrlParser: true,
                    useUnifiedTopology: true,
                    // directConnection: true,
                    // tls: true,
                    // tlsCAFile: this.certPath,
                    // tlsAllowInvalidHostnames: true,
                    // tlsAllowInvalidCertificates: true,
                    // retryWrites: false,
                    // authMechanism: 'SCRAM-SHA-1',
                    // authSource: 'admin',
                    // ssl: true,
                    // replicaSet: 'rs0',
                });
            });
        }

        return this.metaConnection;
    }

    /** Connects to a tenant's database */
    getTenantConnection(companyName, connectionUri) {
        if (!connectionUri) {
            console.error(`Missing connection URI for company: ${companyName}`);
            return;
        }
        if (this.connections[companyName]) {
            return this.connections[companyName];
        }

        const baseUri = connectionUri.split('?')[0];
        console.log(`Creating new tenant connection for ${companyName} with URI:`, baseUri);

        const tenantConnection = mongoose.createConnection(baseUri, {
            maxPoolSize: 10,
            minPoolSize: 5,
            maxIdleTimeMS: 60000,
            useNewUrlParser: true, // Ensure to use the new URL parser
            useUnifiedTopology: true, // Use the new unified topology
            // directConnection: true,
            // tls: true,
            // tlsCAFile: this.certPath,
            // tlsAllowInvalidHostnames: true,
            // tlsAllowInvalidCertificates: true,
            // retryWrites: false,
            // authMechanism: 'SCRAM-SHA-1',
            // authSource: 'admin',
            // ssl: true, // Ensure SSL is enabled
            // replicaSet: 'rs0', // Amazon DocumentDB requires replica set
        });

        tenantConnection.on('connecting', () => {
            console.log(`Tenant DB (${companyName}): Attempting to connect...`);
        });

        tenantConnection.on('connected', () => {
            console.log(`Tenant DB (${companyName}): Successfully connected`);
        });

        tenantConnection.on('disconnected', () => {
            console.log(`Tenant DB (${companyName}): Disconnected`);
        });

        tenantConnection.on('error', (err) => {
            console.error(`Tenant DB (${companyName}) connection error:`, err);
        });

        this.connections[companyName] = tenantConnection;
        return tenantConnection;
    }

    /** Closes all active database connections */
    async closeAllConnections() {
        console.log('Closing all MongoDB connections...');

        if (this.metaConnection) {
            await this.metaConnection.close();
            console.log('Meta DB connection closed.');
        }

        for (const company in this.connections) {
            await this.connections[company].close();
            console.log(`Tenant DB connection closed: ${company}`);
        }
    }
}

export default ConnectionManager.getInstance();
