FROM node:8-onbuild

# this must have been why my docker instance was diverging (node's cron module on localtime)
# should be /usr/share/zoneinfo/Canada/Eastern not /usr/share/zoneinfo/EST
RUN ln -sf /usr/share/zoneinfo/Canada/Eastern /etc/localtime

# No longer necessary, goedel is no more....
# Run as daniel.daniel (1000.1000) to match cantors ids
# RUN groupadd -r -g 1000 daniel && useradd -r -g daniel -u 1000 daniel
# USER daniel

# Default port
EXPOSE 8000

# Repeat thi to assign USER properly
CMD [ "npm", "start" ]
