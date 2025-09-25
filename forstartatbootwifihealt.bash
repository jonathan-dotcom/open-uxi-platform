# Which interface name does your Pi use?
iw dev | awk '/Interface/ {print $2}'

# Is it connected and what exactly does the signal line look like?
iw dev <iface> link

