
import app_config from '@/app_config.json'


export {getters_ as getters}
const getters_ = {}


// System messages
// WARN Do not use <p> as not normally allowed and adds margin
// TODO Make tips version for Singit
const MSG_WELCOME_SELAH = {
    html: `Welcome! This app is a free gift from Gracious Tech, a Christian apps ministry.`,
    button: {
        action: 'fund_selah',
        text: "More apps by us",
    },
}
const MSG_WELCOME_SINGIT = {html: "Welcome to Singit Cloud!"}
const MSG_TIPS_ADMIN = {html: `
    Get started:
    <ol>
        <li><strong>Edit playlist & invite guests</strong></li>
        <li><strong>Start call in another app</strong></li>
        <li><strong>Use earphones</strong> (so no echo)</li>
    </ol>
    <em>"How To Use"</em> tab has more tips
`}
const MSG_TIPS_GUEST = {html: `
    Quick tips:
    <ol>
        <li><strong>Use earphones</strong> (so no echo)</li>
        <li><strong>Check out <em>"How To Use"</em> tab</strong></li>
    </ol>
`}


export function actions(db, api){return {

    handle_unknown({dispatch}, info){
        // Handle an improperly formatted message (probably an Internal Server Error from AWS)
        // NOTE Since server's fault don't fail (as problem may resolve itself, e.g. a timeout)
        dispatch('show_notification', "Something went wrong :/")
        self._fail_log(JSON.stringify(info))
    },

    // SOCKET

    handle_socket_open({state, dispatch}, event){
        // Join room after opening new socket if already entered one
        if (state.tmp.room){
            dispatch('client_join', state.tmp.room.id)
        }
    },

    handle_socket_error({dispatch}, event){
        // Ignore timeout errors (as `close` will also get called and show message), else report
        if (event.message === 'TIMEOUT'){
            return
        }
        self._fail_log(event.message)
        dispatch('show_notification', "Could not connect to server")
    },

    handle_socket_close({dispatch}, event){
        // If socket closed for some reason will auto reconnect so just tell user that
        dispatch('show_notification', "Reconnecting...")
    },

    // CLIENT

    handle_client_time({state, commit}, {client_start, client_end, server}){
        // Process the results of a time sync
        // NOTE Times are in milliseconds

        // Keep track of how many successful checks so far
        commit('tmp_set', ['time_diff_checks', state.tmp.time_diff_checks + 1])

        // Calculate one-way latency
        const latency = (client_end - client_start) / 2

        // Calculate difference between server and client time
        // Guess what client's time would have been when message reached server by adding latency
        const client_mid_guess = client_start + latency
        const time_diff = client_mid_guess - server

        // Update time diff if lowest latency so far (i.e. most accurate time diff)
        const prev_latency = state.tmp.time_diff_latency
        if (prev_latency === null || prev_latency > latency){
            commit('tmp_set', ['time_diff', time_diff])
            commit('tmp_set', ['time_diff_latency', latency])
        }
    },

    handle_client_error({}, info){
        // This shouldn't happen so fail hard
        throw new Error(`Client Error\n\n${info.message}\n\n${JSON.stringify(info.received)}`)
    },

    handle_client_confused({dispatch}, info){
        // Not an error so just display warning in a snackbar
        // TODO Define more helpful messages client-side with i18n (server just send codes)
        dispatch('show_notification', info.message)
    },

    // ROOM

    handle_room_created({state, commit, dispatch}, {room, secret, clients, you}){
        // Room created successfully

        // Remember room in history
        dispatch('known_rooms_update', [room.id, {
            name: room.name,
            secret: secret,
            last_entered: new Date(),
        }])

        // Change state to reflect the room
        commit('tmp_set', ['room', room])
        commit('tmp_set', ['room_clients', clients])
        commit('tmp_set', ['room_admin', true])
        commit('tmp_set', ['room_synced', null])
        commit('tmp_set', ['room_messages', []])
        commit('tmp_set', ['room_messages_unread', 0])

        // Add socket to array if new
        if (!state.tmp.own_sockets.includes(you)){
            commit('tmp_add', ['own_sockets', you])
        }

        // Add system messages
        dispatch('room_message_system',
            app_config.domain === 'selah.cloud' ? MSG_WELCOME_SELAH : MSG_WELCOME_SINGIT)
        dispatch('room_message_system', MSG_TIPS_ADMIN)
    },

    handle_room_joined({state, commit, dispatch}, {room, clients, admin, you}){
        // Successfully joined a room

        // Add/update room in history
        dispatch('known_rooms_update', [room.id, {
            name: room.name,
            last_entered: new Date(),
        }])

        // Change state to reflect the room
        commit('tmp_set', ['room', room])
        commit('tmp_set', ['room_clients', clients])
        commit('tmp_set', ['room_admin', admin])
        commit('tmp_set', ['room_synced', null])
        commit('tmp_set', ['room_messages', []])
        commit('tmp_set', ['room_messages_unread', 0])

        // Add socket to array if new
        if (!state.tmp.own_sockets.includes(you)){
            commit('tmp_add', ['own_sockets', you])
        }

        // Add system messages
        dispatch('room_message_system',
            app_config.domain === 'selah.cloud' ? MSG_WELCOME_SELAH : MSG_WELCOME_SINGIT)
        dispatch('room_message_system', admin ? MSG_TIPS_ADMIN : MSG_TIPS_GUEST)
    },

    handle_room_invalid({state, commit}, {room_id}){
        // Handle a report that the requested room does not exist

        // Collect the ids in an array so room route can know if join will never work
        if (!state.tmp.invalid_rooms.includes(room_id)){
            commit('tmp_add', ['invalid_rooms', room_id])
        }

        // Ensure removed from known_rooms
        if (room_id in state.known_rooms){
            commit('known_rooms_remove', room_id)
        }
    },

    handle_room_state({state, commit, dispatch}, room){
        // Update the room state with latest values

        // Only update if room id matches, otherwise could prevent leaving room if lag
        if (room.id !== state.tmp.room?.id){
            return
        }

        // Update room state
        commit('tmp_set', ['room', room])

        // Update known room's recorded name if it changed
        if (state.known_rooms[room.id].name !== room.name){
            dispatch('known_rooms_update', [room.id, {
                name: room.name,
            }])
        }
    },

    handle_room_clients({state, commit}, {room_id, clients}){
        // Update the room state with latest values
        // WARN Only update if room id matches, otherwise could display wrong room's clients if lag
        if (room_id === state.tmp.room?.id){
            commit('tmp_set', ['room_clients', clients])
        }
    },

    handle_room_message({state, dispatch}, message){
        // Add the message to the list of received messages
        // WARN Only add if room id matches, otherwise could receive from wrong room if lag
        if (message.room_id === state.tmp.room?.id){
            dispatch('room_message_receive', message)
        }
    },

    // PAYMENT

    handle_payment_session({}, session_id){
        // Redirect to checkout page
        const stripe = self.Stripe(app_config.stripe_key_public)
        stripe.redirectToCheckout({sessionId: session_id})
    },

}}
