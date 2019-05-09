# mars-property-authority

This is the REST APIs server for Property Authority.

## ENVs

The following ENVs are required while starting the container:

1. `AWS_KEY`: IAM access key
2. `AWS_SECRET_KEY`: IAM secret key
3. `AWS_REGION`: Region where managed blockchain member is deployed
4. `CA_USERNAME`: CA username
5. `CA_PASSWORD`: CA password
6. `NETWORK_ID`: Managed blockchain member ID
7. `ORDERER_URL`: Orderer URL of the network
8. `CORE_PEER_ADDRESS`: Peer URL of the member
9. `CORE_PEER_TLS_ENABLED`: true
10. `CORE_PEER_TLS_ROOTCERT_FILE`: /home/managedblockchain-tls-chain.pem
11. `CORE_PEER_LOCALMSPID`: Managed blockchain member ID
12. `CORE_PEER_MSPCONFIGPATH`: /home/admin-msp

## Creating Channel

First ssh into the EC2 that's running the container. Then gain access to shell of the container using this command: `docker exec -i -t container_id /bin/bash`. Then create "property" channel with only property channel as member.


1. Replace content of configtx.yaml with this:

```yaml
Organizations:
    - &Org1
        Name: member-id
        ID: member-id
        MSPDir: /home/admin-msp
        AnchorPeers:
            - Host:
              Port:
Application: &ApplicationDefaults
     Organizations:
Profiles:
    OneOrgChannel:
        Consortium: AWSSystemConsortium
        Application:
            <<: *ApplicationDefaults
            Organizations:
                - *Org1
```

> Add Member ID of the property organisation for values Name and ID

4. Then run this command to generate the configtx peer block: `configtxgen -outputCreateChannelTx /home/property.pb -profile OneOrgChannel -channelID property --configPath /home/`
5. Now create the channel using this command: `peer channel create -c property -f /home/property.pb -o $ORDERER_URL  --cafile /home/managedblockchain-tls-chain.pem --tls`
6. Join property authority peer to the channel by running this command: `peer channel join -b /home/property.block -o $ORDERER_URL --cafile /home/managedblockchain-tls-chain.pem --tls`