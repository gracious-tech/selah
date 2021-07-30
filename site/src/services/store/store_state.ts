
import {IDBPDatabase} from 'idb'

import {StateDatabase} from './store_db'
import {nested_objects_set, NestedKeyMissing, catch_only} from '@/services/utils'


export interface AppState {

    // Preferences
    dark:boolean
    name:string
    volume:number
    debug:boolean

    // Private state
    show_splash_welcome:boolean
    show_install_banner:boolean
    offline_opens:number
    singit_paid:boolean,

    // Known rooms
    known_rooms:{[id:string]:AppKnownRoom}

    // Tmp
    tmp:{

        // Viewport dimensions (excluding scrollbars)
        viewport_width:number,
        viewport_height:number,

        // Snackbar and dialog state
        snackbar:boolean,
        snackbar_text:string,
        dialog:string,

        // Time sync
        time_diff:number,
        time_diff_latency:number,
        time_diff_checks:number,

        // Generic room state
        room:{
            id:string,
            name:string,

            // Media
            media:AppRoomMedia[],
            loaded:number,
            start:number,
            paused:number,

            // Permissions
            admins_only_dj:boolean,
            admins_only_see_clients:boolean,
            admins_only_chat:boolean,
        },
        room_clients:{
            admins:AppRoomClient[],
            guests:AppRoomClient[],
            hidden:boolean,
            limited:boolean,
            total:number,
        },

        // Room state specific to client
        room_admin:boolean,
        room_synced:number,
        room_messages:AppRoomMessage[],
        room_messages_unread:number,

        // Room state that persists across rooms
        client_classes:{[socket:string]:string},
        client_classes_next:number,
        invalid_rooms:string[],
        own_sockets:string[],  // WARN Only available after entering room (to filter clients list)
    }
}


interface AppKnownRoom {
    name:string
    secret:string
    starred:boolean
    last_entered:Date
}


interface AppRoomMedia {
    id:string
    name:string
    type:string
    content:{}  // Different depending on the type
}


interface AppRoomClient {
    socket:string
    name:string
    admin:boolean
    synced:number
}


interface AppRoomMessage {
    id:string
    room_id:string
    sender:string
    name:string
    html:string
    timestamp:number
}


export async function get_initial_state(db:IDBPDatabase<StateDatabase>):Promise<AppState>{

    // Get existing known rooms
    const known_rooms = {}
    for (const room of await db.getAll('known_rooms')){
        known_rooms[room.id] = room
        delete room.id  // Storing as the key rather than as a property
    }

    // Construct full state with defaults
    const state = {

        // Preferences
        dark: true,
        name: null,
        volume: 100,  // Usually want voices in bg, so default to max volume
        debug: false,

        // Private state
        show_splash_welcome: true,
        show_install_banner: true,
        offline_opens: 0,
        singit_paid: null,  // null = 1 free add, false = must pay, true = paid

        // Known rooms
        known_rooms,

        // Tmp
        tmp: {

            // Viewport dimensions (excluding scrollbars)
            // NOTE clientWidth of <html> returns viewport less scrollbars (unlike innerWidth)
            viewport_width: self.document.documentElement.clientWidth,
            viewport_height: self.document.documentElement.clientHeight,

            // Snackbar and dialog state
            snackbar: false,
            snackbar_text: null,
            dialog: null,

            // Time sync
            time_diff: 0,  // Until know any better
            time_diff_latency: null,
            time_diff_checks: 0,

            // Generic room state
            room: null,
            room_clients: null,

            // Room state specific to client
            room_admin: null,
            room_synced: null,
            room_messages: [],
            room_messages_unread: 0,

            // Room state that persists across rooms
            client_classes: {},
            client_classes_next: 0,
            invalid_rooms: [],
            own_sockets: [],  // WARN Only available after entering room (to filter clients list)
        },
    }

    // Get stored dict values
    const items = await db.getAll('dict')

    // Override store defaults with all stored values
    // NOTE Values are only written when changed, so many keys will not have values stored
    for (const item of items){
        try {
            nested_objects_set(state, item.key.split(KEY_SEPARATOR), item.value)
        } catch (error){
            catch_only(NestedKeyMissing, error)
            // Key is obsolete (from old app version or old room residue from mulitple tabs)
            // TODO Logging for now, for review later and possible auto-deletion if safe
            // WARN Do NOT expose any user data (key should be ok, but value not)
            self._fail_log(`Obsolete key detected: ${item.key}`)
        }
    }

    // Return the state
    // WARN Do not return until updating it has finished (await all async tasks)
    return state
}


export const KEY_SEPARATOR = '$'
