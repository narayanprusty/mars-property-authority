FROM hyperledger/fabric-tools:1.4

RUN apt-get update && apt-get install -y --no-install-recommends apt-utils build-essential telnet emacs libtool libltdl-dev unzip python3 screen
RUN curl "https://s3.amazonaws.com/aws-cli/awscli-bundle.zip" -o "awscli.zip" && unzip awscli.zip && ./awscli-bundle/install -i /usr/local/aws -b /usr/local/bin/aws
RUN curl -sSL http://bit.ly/2ysbOFE | bash -s 1.3.0
RUN mv  ./fabric-samples/bin/* /usr/local/bin
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash
RUN curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add - && echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list && apt update && apt install -y yarn

WORKDIR /home

ENV GOPATH /opt/gopath
ENV CORE_LOGGING_LEVEL info
ENV CORE_PEER_ID cli

COPY package.json yarn.lock ./
RUN yarn install
COPY ./src ./src

CMD ["yarn", "start"]

