
<template lang='pug'>

//- Use v-if as well so not in DOM when not needed
v-dialog(v-if='show_dialog' v-model='show_dialog')
    v-card
        v-card-title Copy this room
        v-card-text
            p(class='body-1') You've been invited to make a copy of room "{{ room.name }}". This will allow you to have a separate room with the same content but different guests.
        v-card-actions
            v-btn(@click='show_dialog = false' text color='primary') Ignore
            v-btn(@click='copy_room' text color='primary') Copy room


</template>


<script lang='ts'>

import {Component, Vue, Watch} from 'vue-property-decorator'


@Component({})
export default class extends Vue {

    show_dialog = false

    get room(){
        return this.$store.state.tmp.room
    }

    created(){
        // Show dialog if 'copy' param in URL
        this.show_dialog = 'copy' in this.$route.query
    }

    @Watch('$route.query') watch_route_query(query_new, query_old){
        // Reassess if should show dialog (components reused when switching to copy)
        // WARN beforeRouteUpdate won't work as not using router-view for this component
        this.show_dialog = 'copy' in query_new
    }

    copy_room(){
        // Create a copy of the room
        // NOTE Server response will force user into the new room
        this.$store.dispatch('room_copy', this.room.id)
    }

}

</script>


<style lang='sass' scoped>


</style>
