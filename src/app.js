const shell = require('shelljs')
const fs = require('fs')
const app = require('express')()
const Wallet = require('ethereumjs-wallet');
const shortid = require('shortid');
const base64 = require('base-64');
const crypto = require('crypto');
const dynamo = require('dynamodb');
const bodyParser = require('body-parser')
const Joi = require('@hapi/joi');
const EthCrypto = require('eth-crypto');
const sha256 = require('sha256')
const eccrypto = require("eccrypto");
const btoa = require('btoa');

const networkId = process.env.NETWORK_ID
const memberId = process.env.CORE_PEER_LOCALMSPID
const region = process.env.AWS_REGION
const key = process.env.AWS_KEY
const secret_key = process.env.AWS_SECRET_KEY
const username = process.env.CA_USERNAME
const password = process.env.CA_PASSWORD
const orderer = process.env.ORDERER_URL
const peer = process.env.CORE_PEER_ADDRESS

let caEndPoint = null

shell.cd("/home/crypto")

dynamo.AWS.config.update({region: region});
app.use(bodyParser.json())
app.use(cors())

async function runCommand(cmd) {
  return new Promise((resolve, reject) => {
    shell.exec(cmd, {silent: true}, function(code, stdout, stderr) {
      if(code !== 0) {
        reject(stderr)
      } else {
        resolve(stdout)
      }
    })
  })
}

(async () => {
  try {
    shell.exec(`aws configure set aws_access_key_id ${key}`)
    shell.exec(`aws configure set aws_secret_access_key ${secret_key}`)
    shell.exec(`aws configure set region ${region}`)
    
    let output = await runCommand(`aws managedblockchain get-member --network-id ${networkId} --member-id ${memberId}`)
    output = JSON.parse(output)

    caEndPoint = output.Member.FrameworkAttributes.Fabric.CaEndpoint

    if (!fs.existsSync(`/home/crypto/admin-msp`)) {
      shell.exec(`aws s3 cp s3://us-east-1.managedblockchain/etc/managedblockchain-tls-chain.pem  /home/crypto/managedblockchain-tls-chain.pem`)
      shell.exec(`fabric-ca-client enroll -u https://${username}:${password}@${caEndPoint} --tls.certfiles /home/crypto/managedblockchain-tls-chain.pem -M /home/crypto/admin-msp`)
      shell.exec(`cp -r admin-msp/signcerts admin-msp/admincerts`)

      const configtx = `
        ################################################################################
        #
        #   Section: Organizations
        #
        #   - This section defines the different organizational identities which will
        #   be referenced later in the configuration.
        #
        ################################################################################
        Organizations:
            - &Org1
                    # DefaultOrg defines the organization which is used in the sampleconfig
                    # of the fabric.git development environment
                Name: ${memberId}
                    # ID to load the MSP definition as
                ID: ${memberId}
                MSPDir: /home/crypto/admin-msp
                    # AnchorPeers defines the location of peers which can be used
                    # for cross org gossip communication.  Note, this value is only
                    # encoded in the genesis block in the Application section context    
                AnchorPeers:    
                    - Host: 
                      Port:    

        ################################################################################
        #
        #   SECTION: Application
        #
        #   - This section defines the values to encode into a config transaction or
        #   genesis block for application related parameters
        #
        ################################################################################
        Application: &ApplicationDefaults
                # Organizations is the list of orgs which are defined as participants on
                # the application side of the network
            Organizations:

        ################################################################################
        #
        #   Profile
        #
        #   - Different configuration profiles may be encoded here to be specified
        #   as parameters to the configtxgen tool
        #
        ################################################################################
        Profiles:
            OneOrgChannel:
                Consortium: AWSSystemConsortium
                Application:
                    <<: *ApplicationDefaults
                    Organizations:
                        - *Org1
      `

      fs.writeFileSync('./configtx.yaml', configtx)
    }
  } catch(e) {
    console.log(e)
    process.exit();
  }
})()

let PropertyAuthority = dynamo.define('PropertyAuthority', {
  hashKey : 'type',
  timestamps : true,
  schema : {
    type: Joi.string(),
    publicKey: Joi.string(),
    privateKey: Joi.string()
  }
});

async function getKey() {
  return new Promise((resolve, reject) => {
    PropertyAuthority.query("preKey").exec((err, key) => {
      if(err || !key.Count) {
        reject(err)
      } else {
        resolve({
          publicKey: key.Items[0].get("publicKey"),
          privateKey: key.Items[0].get("privateKey")
        })
      }
    });
  })
} 

dynamo.createTables((err) => {
  PropertyAuthority.query("preKey").exec((err, key) => {
    if(!key.Count) {
      let wallet = Wallet.generate();
      let privateKey = wallet.getPrivateKey().toString("hex");
      let publicKey = EthCrypto.publicKey.compress(wallet.getPublicKey().toString("hex"))
  
      PropertyAuthority.create({publicKey, privateKey, type: "preKey"});
    }
  });
});

app.get('/getPREKey', async (req, res) => {
  try {
    let key = await getKey()
    res.send({message: key.publicKey})
  } catch(e) {
    res.send({message: e, error: true})
  }
})

app.get('/signAccess', async (req, res) => {
  let id = req.query.id

  try {
    let key = await getKey()
    let message = JSON.stringify({publicKey: key.publicKey, id})
    let messageHash =  crypto.createHash("sha256").update(message).digest()
    
    eccrypto.sign(Buffer.from(key.privateKey, 'hex'), messageHash).then((signature) => {
      res.send({message: signature.toString('hex')})
    })
  } catch(e) {
    res.send({message: e, error: true})
  }
})

function hexToBase64(str) {
  return btoa(String.fromCharCode.apply(null,
    str.replace(/\r|\n/g, "").replace(/([\da-fA-F]{2}) ?/g, "0x$1 ").replace(/ +$/, "").split(" ")));
}

app.post('/decryptMetadata', async (req, res) => {
  let preKey = req.body.preKey
  let capsule = req.body.capsule
  let metadataEncrypted = req.body.metadataEncrypted
  let id = req.body.id

  try {
    let key = await getKey()

    let userBlockchainInfo = await runCommand(`peer chaincode query -n identity -c '{"Args":["getIdentity","${id}"]}' -C identity --cafile /home/crypto/managedblockchain-tls-chain.pem --tls`)
    userBlockchainInfo = JSON.parse(userBlockchainInfo)

    let result = await runCommand(`python3 /home/app/src/crypto-operations/decrypt-pre.py ${preKey} ${capsule} ${metadataEncrypted} ${hexToBase64(key.privateKey)} ${hexToBase64(key.publicKey)} ${hexToBase64(userBlockchainInfo.publicKey)}`)
    res.send({message: JSON.parse(result.substr(2).slice(0, -2))})
  } catch(e) {
    console.log(e)
    res.send({message: e, error: true})
  }
})

app.post('/addProperty', async (req, res) => {
  let propertyId = shortid.generate()
  let location = req.body.location
  let owner = req.body.owner

  try {
    await runCommand(`peer chaincode invoke -n property -c '{"Args":["addProperty", "${propertyId}", "${location}", "${owner}"]}' -C property -o $ORDERER_URL --cafile /home/crypto/managedblockchain-tls-chain.pem --tls`)
    res.send({message: propertyId})
  } catch(e) {
    res.send({message: e, error: true})
  }
})

app.get('/getProperty', async (req, res) =>  {
  let propertyId = req.query.propertyId
  
  try {
    let property = await runCommand(`peer chaincode query -n property -c '{"Args":["getProperty","${propertyId}"]}' -C property --cafile /home/crypto/managedblockchain-tls-chain.pem --tls`)
    property = JSON.parse(property)
    res.send({message: property})
  } catch(e) {
    res.send({message: e, error: true})
  }
})

app.post('/transferProperty', async (req, res) => {
  let signature = req.body.signature
  let propertyId = req.body.propertyId
  let newOwner = req.body.newOwner

  try {
    await runCommand(`peer chaincode invoke -n property -c '{"Args":["transferProperty", "${propertyId}", "${newOwner}", "${signature}", "identity"]}' -C property -o $ORDERER_URL --cafile /home/crypto/managedblockchain-tls-chain.pem --tls`)
    res.send({message: propertyId})
  } catch(e) {
    res.send({message: e, error: true})
  }
})

app.listen(3000, () => console.log('API Server Running'))