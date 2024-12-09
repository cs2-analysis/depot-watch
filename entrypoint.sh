#!/bin/sh

node index.js "$@"

# if we exit with 2, we shouldn't attempt to restart
if [ $? -eq 2 ]; then
  echo "Error: detected invalid version change, sleeping indefinitely"
  while true; do sleep 1000; done
fi

exit $?