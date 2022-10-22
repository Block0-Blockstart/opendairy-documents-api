# opendairy-document-api

API handling document exchanges and notarization

## Installation

```bash
$ npm install
```

## Commands

```bash
# run app in development mode
$ npm run start

# run app in development watch mode
$ npm run start:dev

# run app in production mode
$ npm run start:prod

# generate the documentation
$ npm run compodoc

# generate the documentation and serve it
$ npm run compodoc:serve

# unit tests
$ npm run test

# unit tests in watch mode
$ npm run test:watch

# e2e tests
$ npm run test:e2e

# e2e tests with extended logs
$ npm run test:e2e-verbose

# run linter with autofix
$ npm run lint
```


## Environment variables

| name | value | example |
| --- | --- | --- |
| ```NODE_ENV``` | development \|\| production \|\| test | development |
| ```PORT``` | number | 42003 |
| ```WITH_SWAGGER``` | 'yes' \|\| anything else | yes |
| ```API_CONTRACTS_FULL_URL``` | url + port to contracts API  | https://domain.com:443 |
| ```API_AUTH_FULL_URL``` | url + port to auth API  | https://domain.com:443 |
| ```AWS_COGNITO_URL``` | url to cognito  | https://domain.com |
| ```AWS_S3_REGION``` | string  | eu-central-1 |
| ```AWS_S3_BUCKET_NAME``` | string  | opendairy-documents |
| ```AWS_S3_BUCKET_ARN``` | string  | arn:aws:s3:::opendairy-documents |
| ```AWS_S3_ACCESS_KEY_ID``` | string (only needed for local dev)  | SECRETULTRASECRET |
| ```AWS_S3_SECRET_ACCESS_KEY``` | string (only needed for local dev)  | ThisIsAlsoSecretUltraSecret |
| ```BLOCKCHAIN_RPC_URL_PORT``` | url + port to RPC node  | http://127.0.0.1:7545 |
| ```BLOCKCHAIN_CHAIN_ID``` | chain id number  | 1337 |
| ```BLOCKCHAIN_TX_GAS_PRICE``` | number  | 0 |
| ```BLOCKCHAIN_TX_GAS_LIMIT``` | number  | 3000000 |
| ```BLOCKCHAIN_TX_TYPE``` | number  | 0 |
| ```ADMIN_WALLET_STRATEGY``` | FROM_FILE \|\| FROM_ENV  | FROM_FILE |
| ```ADMIN_WALLET_PRIVATE_KEY``` | string (only required if ADMIN_WALLET_STRATEGY is FROM_ENV | 0xsomeprivatekey |
| ```ADMIN_CONTRACT_ACCOUNTS``` | string (only required if ADMIN_WALLET_STRATEGY is FROM_ENV | 0xsomecontractaddress |


### Using .env file
While developing, you can pass environment variables using a .env file.
See .env.example at project root folder.   
You MUST use ```npm run start:dev``` when using an .env file.

### Using Windows Powershell
To pass env variables in a Windows Powershell console :
```posh
$env:PORT=42003; $env:NODE_ENV="production"; npm run start
 ```
:warning: The variables will remains after node process exits. You can reset them using command :
```posh
$env:PORT=$null; $env:NODE_ENV=$null
 ```

### Using Linux console
To pass env variables under Linux:
```sh
PORT=42003 NODE_ENV=production npm run start
```
The variables will be set only during the process execution (reset after process ends).

### Using Docker
see Docker deployment below.

### Using cloud services like AWS, Azure, ...
There are many tools allowing you to pass env variables securely using a managed environment. It depends of the service you use. See its documentation.


## Deploy with Docker
This procedure is for deployment on an AWS EC2 instance. The same can be done locally or on any virtual server with Docker installed.

1. **<u>Log on EC2</u>**

Use your favorite SSH tool to access your server instance.


2. **<u>Build the Docker image</u>**


A. **Build the image directly from the Git repo**

```sh
sudo docker build -t opendairy-documents-api:latest https://github.com/Block0-Blockstart/opendairy-documents-api.git
```

B. **Aternative: copy the repo**

* Clone a fresh copy of the git main branch locally.\
DO NOT npm install, as we don't want any node_modules !           

* Then, upload the whole project directory to the EC2 (FileZilla can do this).

* On the EC2, open a console and navigate to the directory you have just copied. Now, build the image:

    ```sh
    sudo docker build -t opendairy-documents-api:latest .
    ``` 

    WARNING: notice the '.' at the end of the command line to instruct Docker to use the Dockerfile in current directory.

3. **<u>Run the image</u>**

You need to pass the environment variables to docker when running the image. There are many options to do this.


* *passing args to the docker run command*

You can pass the required variables directly to the docker run command. Example for NODE_ENV and PORT variables:

```sh
sudo docker run --name opendairy-documents-api \
-it -e NODE_ENV=development -e PORT=42003 \
-p 42003:42003 --restart=unless-stopped \
opendairy-documents-api:latest
```

:warning: Anyone with access to the Docker runtime can inspect a running container and discover the env values. For example:
```sh
$ docker inspect 6b6b033a3240

"Config": {
  // ...
  "Env": [
    "PORT=42003",
    "NODE_ENV=development",
    // ...
  ]
}
```

* *setting the environment variables in Dockerfile*

You can declare your environment variables in the DockerFile. This way, you can run the image with this simple command:

```sh
sudo docker run --name opendairy-documents-api -it -p 42003:42003 --restart=unless-stopped opendairy-documents-api:latest
```
:warning: Anyone with access to the Dockerfile can dicover your values.

* *using a temporary .env file*

Create a .env file at project's root (on the EC2) and pass the file path to the docker run command. Example:

```sh
sudo docker run --name opendairy-documents-api \
-it --env-file=.env \
-p 42003:42003 --restart=unless-stopped \
opendairy-documents-api:latest
```

Then you can delete the .env file, so that nobody can discover your values. This is more secure (see also https://docs.docker.com/engine/swarm/secrets/).

**Additional notes about secret values:**

- S3 access can be granted through an IAM role given to the EC2 instance. This way, you don't have to provide S3 credentials as environment variables (```AWS_S3_ACCESS_KEY_ID``` and ```AWS_S3_SECRET_ACCESS_KEY```).

- If you set the ```ADMIN_WALLET_STRATEGY``` to "FROM_FILE", there will be a config file generated when you launch the api the first time. It is used to deploy required contracts with a new admin user. The file is stored in the container and contains the admin private key. You should:
    * use this strategy only if your docker container is not accessible by unauthorized people. You should also make a backup of the config file (adminSetup.json) in case you launch a new image and you want to reuse the former admin wallet.
    * or switch to "FROM_ENV" strategy and pass the required variables (```ADMIN_WALLET_PRIVATE_KEY``` and ```ADMIN_CONTRACT_ACCOUNTS```) using temporary env file.


4. **<u>AWS: update security group</u>**

If you use an AWS EC2, don't forget to update your security group rules to open the port used by this api. Add an inbound rule:

  | Type | Protocol | Port range | Source | Description (optional) |
  | --- | --- | --- | --- | --- |
  | Custom TCP | TCP | 42003 | 0.0.0.0/0, ::/0 | Allows connections to opendairy-documents-api

## Generating documentation

```bash
# generate the documentation
$ npm run compodoc

# generate the documentation and serve it
$ npm run compodoc:serve
```
The documentation is generated at root and is served on the port 8080

## Testing

Tests are very limited due to prototype development time constraints. But the tools required to implement a full test suite are integrated, including a local chain (ganache CLI).


## Database

There are 3 databases, one for each mode (test, development and production). All are sqlite3.     
In production, the project is intended to be used with Postgres. However, we kept sqlite as it is a prototype and it should be integrated with the existing OpenDairy system (and database).

The ORM library used in the project allows for quite easy migration to postgres (change the typeorm config for production by passing the db credentials).

# Contact
**block0**
+ info@block0.io
+ [https://block0.io/](https://block0.io/)

# License
This repository is released under the [MIT License](https://opensource.org/licenses/MIT).