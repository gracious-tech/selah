
<template lang='pug'>

div.root
    div(class='name')
        v-text-field(v-model='name' @keydown.enter='set_name' label="Room name"
                hint="Default room names are phrases from the Psalms")
        v-btn(@click='set_name' :disabled='!name_changeable' color='accent') Save

    v-switch(v-model='admins_only_dj' label="Only admins can edit playlist")
    v-switch(v-model='admins_only_see_clients' label="Only admins can see participants")
    v-switch(v-model='admins_only_chat' label="Only admins can send messages")

</template>


<script lang='ts'>

import {Component, Vue, Prop} from 'vue-property-decorator'


@Component({})
export default class extends Vue {

    name = ''  // Non-init'd properties are non-reactive (later set by `created()`)

    created(){
        // Init name to the current name
        this.name = this.name_current
    }

    get name_current(){
        // Return name currently set for the room
        return this.$store.state.tmp.room.name
    }

    get name_cleaned(){
        // Return name stripped of whitespace
        return this.name.trim()
    }

    get name_changeable(){
        // Return true if name has changed and changed to a valid value
        return this.name_cleaned && this.name_cleaned !== this.name_current
    }

    get admins_only_dj(){
        return this.$store.state.tmp.room.admins_only_dj
    }

    set admins_only_dj(value){
        this.$store.dispatch('room_admins_only', ['dj', value])
    }

    get admins_only_see_clients(){
        return this.$store.state.tmp.room.admins_only_see_clients
    }

    set admins_only_see_clients(value){
        this.$store.dispatch('room_admins_only', ['see_clients', value])
    }

    get admins_only_chat(){
        return this.$store.state.tmp.room.admins_only_chat
    }

    set admins_only_chat(value){
        this.$store.dispatch('room_admins_only', ['chat', value])
    }

    set_name(value){
        // This may be triggered by enter, so can't assume disabled when invalid
        if (this.name_changeable){
            this.$store.dispatch('room_name', this.name_cleaned)
        }
    }

}

</script>


<style lang='sass' scoped>


.root
    padding: 18px
    overflow-y: auto


.name
    display: flex
    align-items: center

    .v-text-field
        margin-right: 12px
        max-width: 300px


</style>
