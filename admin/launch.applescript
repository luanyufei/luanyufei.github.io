on run
	do shell script "cd \"/Users/luanyufei/NOON's Documents/FeeSpace\" && if curl -s -o /dev/null -m 1 http://localhost:4321/api/server/state; then open http://localhost:4321; else /usr/bin/nohup /usr/local/bin/node admin/server.js > /tmp/fee-admin.log 2>&1 & sleep 1.5 && open http://localhost:4321; fi"
end run
