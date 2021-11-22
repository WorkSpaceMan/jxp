FROM node:17

WORKDIR /jxp
COPY package.json .
RUN yarn install
COPY . .
CMD npm start