FROM dockerfile/nodejs
MAINTAINER Teemu Heikkilä <teemu.heikkila@pistoke.org>
RUN apt-get update

# Install warnish
#RUN apt-get install -y varnish supervisor

WORKDIR /data
ADD . /data
RUN ln -s /data/supervisor.conf /etc/supervisor/conf.d/
RUN npm config set registry http://registry.npmjs.org/
RUN cd /data && npm install
ENV PORT 80
EXPOSE 80
CMD ["/usr/local/bin/node", "/data/server.js"]
#cmd ["supervisord", "-n"]
