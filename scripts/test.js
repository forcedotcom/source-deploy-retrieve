const {
    SourceClient
} = require('../lib');
const {
    AuthInfo,
    Connection
} = require('../node_modules/@salesforce/core');
async function deploy(path) {
    const connection = await Connection.create({
        authInfo: await AuthInfo.create({
            username: 'a.stern@creative-panda-vzvoci.com'
        })
    });
    const client = new SourceClient(connection);
    const result = await client.tooling.deployWithPaths({
        paths: [path]
    });
    console.log(result);
}

deploy('/Users/a.stern/Desktop/dreamhouse-lwc/force-app/main/default/classes/deployapex.cls')