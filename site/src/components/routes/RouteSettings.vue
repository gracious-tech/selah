
<template lang='pug'>

div
    v-toolbar(color='primary' light)
        v-btn(icon to='../')
            app-svg(name='icon_arrow_back')
        v-toolbar-title Settings

    app-content(class='pa-3')

        v-text-field(v-model='name' label="Your name" persistent-hint spellcheck='false'
            hint="This will be publicly displayed to other users in any rooms you join")

        v-switch(v-model='dark' label="Dark theme" persistent-hint
            hint="Use dark colors for the app's background which are easier on the eyes at night")
        v-switch(v-model='debug' color='error' label="Show debug info" persistent-hint
            hint="Show information useful for diagnosing problems with the app or network (to send to app developers)")


</template>


<script lang='ts'>

import {Component, Vue} from 'vue-property-decorator'

import {debounce_set} from '@/services/misc'


@Component({})
export default class extends Vue {

    // GENERAL SETTINGS

    get dark(){
        return this.$store.state.dark
    }

    set dark(value){
        this.$store.dispatch('set_dark', value)
    }

    get debug(){
        return this.$store.state.debug
    }

    set debug(value){
        this.$store.commit('dict_set', ['debug', value])
    }

    get name(){
        return this.$store.state.name
    }

    @debounce_set(1000) set name(value){
        // This will trigger an api call, so must debounce to avoid excessive requests
        this.$store.dispatch('client_name', value.trim() || null)
    }

}

</script>


<style lang='sass' scoped>


</style>
