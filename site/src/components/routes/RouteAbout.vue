
<template lang='pug'>

div
    v-toolbar(color='primary' light)
        v-btn(icon to='../')
            app-svg(name='icon_arrow_back')
        v-toolbar-title About

    app-content(class='pa-5')

        template(v-if='is_selah')
            p This app is a free gift from <a href='https://gracious.tech' target='_blank'>Gracious Tech</a>. We create apps that are:
            ul(class='mb-3')
                li Mission-focused
                li High quality
                li Secure
                li Free
            p As such, this app is completely non-profit with no ads, no tracking, and nothing else that would benefit us. This app is for your benefit alone. <!--You can see this for yourself as <a href='https://github.com/gracious-tech/selah' target='_blank'>the code is open source</a>.-->
            p We hope this app helps you to worship God together with other believers when you're not able to do so in person.
            p
                //- v-btn(href='https://github.com/gracious-tech/track' target='_blank' color='primary' text)
                //-     | Source Code
                //-     app-svg(name='icon_open_in_new' class='pl-1')
                v-btn(href='https://gracious.tech' target='_blank' color='primary' text)
                    | gracious.tech
                    app-svg(name='icon_open_in_new' class='pl-1')

        template(v-else)
            p We made this app to help people during COVID, we hope you enjoy it.

        hr

        h4(class='text--secondary') Privacy

        p(class='body-2 text--secondary') We try to protect your privacy as much as possible. For example, we do not store any chat history. Our servers do store data your device sends to us by default (such as your IP address and browser version), as well as any data necessary for the app to function, such as video IDs. Error reports are also sent to us in the rare event the app fails, but they do not contain any sensitive data. The data that is received is used for quality improvement, and never shared with third-parties.

        h4(class='text--secondary') Terms

        p(class='body-2 text--secondary') This app is provided without warranty of any kind. In no event shall the authors or copyright holders be liable for any claim, damages or other liability. We may cease to provide access to this app at any time and for any reason. By using this app you agree to these terms.

        p(class='body-2 text--secondary text-center mt-12') Version {{ version }}
        p(class='body-2 text--secondary text-center') {{ sw_status }}

</template>


<script lang='ts'>

import {Component, Vue} from 'vue-property-decorator'

import app_config from '@/app_config.json'
import {version} from '@/services/misc'


@Component({})
export default class extends Vue {

    version = version
    sw_status = "Offline viewing not supported in this browser"
    is_selah = app_config.domain === 'selah.cloud'

    created(){
        // Check status of SW if supported
        // WARN Currently doesn't listen for changes so must leave/enter to refresh status
        if (self.navigator.serviceWorker){
            // Don't block execution for this
            this.determine_sw_status().then(status => {
                this.sw_status = status
            })
        }
    }

    async determine_sw_status(){

        // Get the SW registration (should only be one), and undefined if haven't registered yet
        const rego = await self.navigator.serviceWorker.getRegistration()
        if (!rego){
            return "Offline viewing not yet initialized"
        }

        // Collect a string of codes for debugging SW
        const codes = []

        // See if page controlled yet
        if (self.navigator.serviceWorker.controller){
            codes.push("controlling")
        }

        // Get info from registration
        for (const key of ['active', 'waiting', 'installing']){
            if (rego[key]){
                codes.push(key)
            }
        }

        return `Offline viewing supported (${codes.join(', ')})`
    }

}

</script>


<style lang='sass' scoped>

hr
    margin: 50px 0

</style>
