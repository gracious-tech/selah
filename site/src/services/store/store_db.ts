
import {openDB, DBSchema} from 'idb'


export interface StateDatabase extends DBSchema {
    dict:{
        key:string,  // The type of whatever key is used (in this case it's value.key)
        value:{
            key:string,
            value:db_value,
        },
    },
    known_rooms:{
        key:string,
        value:{
            id:string,
            name:string,
            secret:string,
            starred:boolean,
            last_entered:Date,
        },
    }
}


export type db_value = string|string[]|number|boolean|null|Date


export async function init_db(){
    // Get access to db (and create/upgrade if needed)

    return openDB<StateDatabase>('state', 1, {
        upgrade(db, old_version, new_version, transaction){

            // Deal with previous versions
            // NOTE old_version is 0 if db doesn't exist yet
            if (old_version === 1){
                // Future upgrade code when have a version 2
            }

            // Create object stores
            // NOTE If no keyPath is given then must provide a key for every transaction
            db.createObjectStore('dict', {keyPath: 'key'})
            db.createObjectStore('known_rooms', {keyPath: 'id'})
        },
    })
}
