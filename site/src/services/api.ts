
import ReconnectingWebSocket from 'reconnecting-websocket'

import app_config from '@/app_config.json'
import {debug} from '@/services/misc'


type QueueItem = [string, {}]


export default class {

    ws
    store
    queue:QueueItem[] = []
    waiters = {}

    get connected(){
        // Return boolean for whether socket is open/connected or not
        return !! (this.ws && this.ws.readyState === this.ws.OPEN)
    }

    connect(store){
        this.store = store

        // Connect to the websocket (careful to only use production if on correct domain!)
        let api_id = process.env.VUE_APP_API
        if (self.document.domain === app_config.domain){
            api_id = app_config.api_id
        } else if (self.document.domain === 'test.' + app_config.domain){
            api_id = app_config.api_id_test
        }
        this.ws = new ReconnectingWebSocket(
            `wss://${api_id}.execute-api.us-west-2.amazonaws.com/stageless`)

        // Handle incoming messages
        this.ws.addEventListener('message', event => {
            // See if a normal JSON message or a time sync
            if (event.data[0] === '{'){
                this.receive(event.data)
            } else {
                // Convert time sync responses into normal message format
                const client_end = new Date().getTime()  // Set final time ASAP!
                const [client_start, server] = event.data.split('\n')
                const data = {
                    type: 'client_time',
                    info: {
                        client_start: Number(client_start),
                        client_end: Number(client_end),
                        server: Number(server),
                    },
                }
                this.receive(data, false)
            }
        })

        // Handle socket events (as if were incoming messages)
        for (const type of ['open', 'close', 'error']){
            this.ws.addEventListener(type, event => {
                this.receive({type: `socket_${type}`, info: event}, false)
            })
        }

        // Send any queued messages whenever connect again
        this.ws.addEventListener('open', () => {

            // Do time syncs until have 3 successes (so can choose one with least latency)
            this.init_sync()  // Attempt first straight away
            let time_sync_interval = null
            time_sync_interval = setInterval(() => {
                if (store.state.tmp.time_diff_checks >= 3){
                    clearInterval(time_sync_interval)
                } else {
                    this.init_sync()
                }
            }, 1000)

            // Send queued messages
            // TODO Test to see if causes issues, especially for a long delay
            //      Could filter and send only the most important or most recent?
            while (this.queue.length){
                this.send(...this.queue.shift())
            }
        })

        // Do extra time syncs as a keep-alive for the client which has a 10 min idle limit
        // See https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html
        setInterval(() => this.init_sync(), 9 * 60 * 1000)  // Every 9 mins
    }

    init_sync(){
        // Init a sync exchange with server
        // NOTE Avoid regular send wrapper to make as fast as possible
        if (this.connected){
            this.ws.send('' + new Date().getTime())
        }
    }

    send(type, info={}){
        // Send a message to the server

        // If socket not open at the moment, queue the message for sending when it reopens
        if (!this.connected){
            this.queue.push([type, info])
            return
        }

        // Send message
        const data = {type, info}
        this.ws.send(JSON.stringify(data))

        // Log messages for debugging
        // NOTE Structure console arg so that message type is visible in console without expanding
        const debug_data = {}
        debug_data[`SENT ${type}`] = info
        debug(debug_data)
    }

    receive(data, json=true){
        // Handle a message from the server

        // Decode unless passed custom data from a socket or sync event
        let message = json ? JSON.parse(data) : data

        // If no message type, then probably an Internal Server Error from AWS
        // Convert to a proper message for store to handle
        if (! ('type' in message)){
            message = {type: 'unknown', info: message}
        }

        // Log messages for debugging
        // NOTE Structure console arg so that message type is visible in console without expanding
        const debug_data = {}
        debug_data[`REC  ${message.type}`] = message.info
        debug(debug_data)

        // Pass over to handler
        this.store.dispatch(`handle_${message.type}`, message.info)
    }
}
