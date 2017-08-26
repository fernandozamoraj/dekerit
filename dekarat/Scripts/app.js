﻿
var USER_SIGNED_OUT_MESSAGE = 'user signed out or failed to sign in...'
var USER_SIGNED_IN_MESSAGE = ' user signed in...'
var user;

var model = {
    CurrentView: ko.observable("main"),
    SignedIn: ko.observable(false),
    Title: ko.observable("dekarat"),
    Message: ko.observable(""),
    changedView: function (x) {
        handleChangeView(x)
    }
}

function handleChangeView(x) {
    model.CurrentView(x)
}

function handleSignOut() {
    var $toastContent = 'You are now signed out of your session';

    Materialize.toast($toastContent, 4000);

    firebase.auth().signOut().then(function () {
        console.log(USER_SIGNED_OUT_MESSAGE)
    })
}

function bindCreateAccountScreen() {

    $('#create-account-screen').click(function () {
        handleSignOut()
        handleChangeView("createaccount")
        addCreateAccountEvents(handleSignIn)

    })
}

function handleSignIn() {

    model.SignedIn(true)


    //I cannot bind on document ready because these were not rendered intitally
    //so I had to do the binding here instead.
    $('#main').click(function () {
        handleChangeView("main")
        model.Title("dekarat")
        model.Message("Welcome to dekarat, a place where you can motivate yourself "
                    + "and your friends to practice healthy habits in a fun way.")

        //for some reason sign-in and create-account unbind when home is clicked
        $('#sign-in').click(function () {
            //TODO: change later to a better approach to signing in
            validateSignIn(handleSignIn)
        })

        bindCreateAccountScreen()
    })

    $('#friends-feed').click(function () {
        handleChangeView("friendsfeed")
        model.Message("")
        model.Title("friends feed")
    })

    $('#status').click(function () {
        handleChangeView("status")
        model.Message("")
        model.Message("status")
    })

    $('#news').click(function () {
        handleChangeView("news")
        model.Message("")
        model.Title("news")
    })

    $('#log-item').click(function () {
        switchToLogEntry()
    })

    
    model.Title("log entry")

    switchToLogEntry()
}

function switchToLogEntry() {
    handleChangeView("logitem")
    model.Message("")
    $('select').material_select();
    $('#entry-submit').click(function () {
        handleEntrySubmit()
    })
}

$(document).ready(function () {

    $('#sign-in').click(function () {
        //TODO: change later to a better approach to signing in
        validateSignIn(handleSignIn)
    })

    $('#sign-out').click(
        function () {
            handleSignOut()
            handleChangeView("main")
        }
     )



    bindCreateAccountScreen()

    model.CurrentView("main")
    ko.applyBindings(model)
});


//TODO: check for real email
function validateSignIn(onSuccess){

    var txtEmail = document.getElementById('email')
    var txtPassword = document.getElementById('password')
    var auth = firebase.auth()

    auth.onAuthStateChanged(function (firebaseUser) {

        if (firebaseUser) {

            var userref = firebase.database().ref('users/'+firebaseUser.uid)

            userref.on('value', function(snap){
                user = snap.val()

                console.log(firebaseUser)
                console.log(userref)
                console.log(user)
                console.log(user.email + USER_SIGNED_IN_MESSAGE)
                onSuccess()
             })


        }
        else {
            console.log(USER_SIGNED_OUT_MESSAGE)
            model.SignedIn(false)
        }
    })

    var promise = auth.signInWithEmailAndPassword(txtEmail.value, txtPassword.value)
        
    promise.catch(function (e) {
        console.log(e.message)
    })
}

function addCreateAccountEvents(onSuccess) {

    var btnCreateAccount = document.getElementById('create-account')

    btnCreateAccount.addEventListener('click', function (e) {

        //TODO: validate email and password
        var txtEmail = document.getElementById('new-email')
        var txtPassword = document.getElementById('new-password')
        var txtFirstName = document.getElementById('firstname')
        var txtLastName = document.getElementById('lastname')


        var auth = firebase.auth()
        auth.onAuthStateChanged(function (firebaseUser) {
            if (firebaseUser) {
                user = {
                    email: firebaseUser.email,
                    firstName: txtFirstName.value,
                    lastName: txtLastName.value,
                    displayName: txtFirstName.value + '.' + txtLastName.value,
                    uid: firebaseUser.uid
                }

                console.log(user)
                console.log(user.email + USER_SIGNED_IN_MESSAGE)

                //This code sets the id (key) of user to the firebaseuserid
                //Instead of using push we use set so that we can have control over
                //the key.
                var users = firebase.database().ref('users')
                users.child(firebaseUser.uid).set(user)
                Materialize.toast("Account successfuly created", 2000)
                Materialize.toast("You are now signed in", 2000)

                onSuccess()
            }
            else {
                console.log(USER_SIGNED_OUT_MESSAGE)
                model.SignedIn(false)
            }
        })

        var promise = auth.createUserWithEmailAndPassword(txtEmail.value, txtPassword.value)

        promise.catch(function (e) {
            console.log(e.message)
        })
    })
}


function handleEntrySubmit() {
    var txtRemarks = document.getElementById('entry-remarks')
    var lb = document.getElementById('entry-options')
    var d = new Date()

    var option = lb.options[lb.selectedIndex].text;

    firebase.database().ref("log_entries").child(user.uid).child(d.getTime()).set({
        uid: user.uid,
        activity: option,
        remarks: txtRemarks.value,
        date: d.getTime()
    })
}



