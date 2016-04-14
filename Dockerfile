FROM node
MAINTAINER Teemu Heikkilä <teemu.heikkila@pistoke.org>
RUN apt-get update

# Install varnish
RUN apt-get install -y varnish supervisor pkg-config curl
# Install sharp
RUN echo "echo jessie" > /usr/bin/lsb_release
RUN chmod +x /usr/bin/lsb_release
RUN curl -s https://raw.githubusercontent.com/lovell/sharp/master/preinstall.sh | bash -

WORKDIR /data
ADD . /data
RUN ln -s /data/supervisor.conf /etc/supervisor/conf.d/
RUN npm config set registry http://registry.npmjs.org/
RUN cd /data && npm install

EXPOSE 80

# If only using node without varnish uncomment next;
ENV PORT 80
CMD ["/usr/local/bin/node", "/data/server.js"]
# Disable supervisord if using only node.js
#CMD ["supervisord", "-n"]
