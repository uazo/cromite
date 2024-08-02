# In order to help me

### Preface

Modifying a browser is complex, not so much because of how it is written but because of what it does. In fact, I believe that reading and modifying the code is just a matter of effort and anyone can do it.

What, for me, is more difficult, is to follow the changes that the chromium team makes and adapt them to what I think is best for Cromite.

I would like these choices not to be made by sentiment but explained and discussed.

But I need to organise the work and it is not easy.

So if you want to help me, this is a list of things to do: I think it is all something doable, I already have in mind how to do it but I don't have the time.

### To get better organised:

#### Chrome and its flags

Chromium is full of flags, some that improve it and some that are harmful to Cromite users. it is not easy to keep up with them all.

Some are activated (or deactivated) by code, others via a google server called finch. The endpoints, however, are public and the protocol code open.
I need something that queries and records daily changes to the flags.

I would also like help on setting up a ui for https://github.com/uazo/bromite-flags-list

#### Blink and all its changes

Blink is the chromium rendering engine, basically what is exposed to site developers. Opening or closing features in blink means opening or closing features for web sites.

Everything is well tracked in the [Blink mail list](https://groups.google.com/a/chromium.org/g/blink-dev/) and in [Chrome Platform Status](https://chromestatus.com/roadmap), but there are many changes being made.

I would like to take advantage of the communication that the Chromium team makes to Firefox by default, where they inform and ask for opinions (which are, however, not binding).

Basically, the Chromium team, with regard to Blink, has to follow a precise procedure (development intention, request to apple and firefox and developers and TAG, documentation on the blog, experimentation, activation, etc.). I would like to latch onto this, because to expect Google to do so is perhaps too much.

I would like something that scans [Mozilla's Positions on Emerging Web Specifications](https://github.com/mozilla/standards-positions/) and creates a specific one for Cromite. It must also be linked with [TAG's review](https://github.com/w3ctag/design-reviews), which is very useful.

### Developing a test suite:

It is unprofessional to develop a browser without tests, not only that, it can be dangerous. Anyone using Cromite must know this. I know this.

What I do I test, but it must be continuously tested, not just when a user complains of a bug.

The Internet is full of test suites for browser, but I need one made for Cromite.

This is a project within a project, which is also extremely complex because it takes a long time to set up.

The ideas I have are varied and confused, but I am open to discussion.

### Improve all the tools I have written:

I know my limitations, and I know I am not good at scripts. Normally, at work, I gladly hand over this task to others. Here there is no one else.

My scripts are haphazard and poorly documented, not good.

If you are a shell developer, I know what to ask you.
