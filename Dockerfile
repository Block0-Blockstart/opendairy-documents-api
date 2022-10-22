# First Stage : install all dependencies (like in development) to allow typescript to be transpiled on build process
# Using Node:16 Image Since it contains all the necessary build tools required for dependencies
# with native build (node-gyp, python, gcc, g++, make)

FROM node:16 AS builder

ENV NODE_ENV=development

WORKDIR /app

COPY package*.json ./

RUN npm i

COPY . .

RUN npm run build

# Second Stage : copy the build folder and run it
# Using Node:16-alpine to have a lightweight container was a bad idea as sqlite requires some OS specific files not included in the alpine bundle
# switching to external database would allow to use the alpine version, in theory.

FROM node:16

ENV NODE_ENV=production
# You can set all other env variables here
# ENV PORT=42003
# ENV WITH_SWAGGER=no
# ENV API_CONTRACTS_FULL_URL=***secret***
# ENV API_AUTH_FULL_URL=***secret***
# ENV AWS_COGNITO_URL=https://cognito-idp.eu-central-1.amazonaws.com
# ENV AWS_S3_REGION=eu-central-1
# ENV AWS_S3_BUCKET_NAME=opendairy-documents
# ENV AWS_S3_BUCKET_ARN=arn:aws:s3:::opendairy-documents
# ENV BLOCKCHAIN_RPC_URL_PORT=***secret***
# ENV BLOCKCHAIN_CHAIN_ID=83584648538
# ENV BLOCKCHAIN_TX_GAS_PRICE=0
# ENV BLOCKCHAIN_TX_GAS_LIMIT=3000000
# ENV BLOCKCHAIN_TX_TYPE=0
# ENV ADMIN_WALLET_STRATEGY=FROM_FILE

WORKDIR /app

COPY --from=builder /app ./

EXPOSE ${PORT}

CMD [ "npm", "run", "start:prod" ]