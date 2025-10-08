// Rebase require directory
requirejs.config({
  baseUrl: "lib",
});

// Default library url
var defaultUrlLibrary = "https://sugarizer.org/content/books.php";

// Vue main app
var app = new Vue({
  el: "#app",
  components: {
    "ebook-reader": EbookReader,
    "library-viewer": LibraryViewer,
    toolbar: Toolbar,
    localization: Localization,
    popup: Popup,
    tutorial: Tutorial,
  },
  data: {
    currentBook: null,
    currentEpub: null,
    currentView: LibraryViewer,
    currentLibrary: { database: [] },
    timer: null,
  },

  created: function () {
    requirejs(
      ["sugar-web/activity/activity", "sugar-web/env"],
      function (activity, env) {
        // Initialize Sugarizer
        activity.setup();
      }
    );
  },

  mounted: function () {
    var vm = this;
    requirejs(
      ["sugar-web/activity/activity", "sugar-web/env"],
      function (activity, env) {
        env.getEnvironment(function (err, environment) {
          // Use buddy color for background
          document.getElementById("canvas").style.backgroundColor =
            environment.user.colorvalue.fill;

          // Load context
          if (environment.objectId) {
            activity.getDatastoreObject().loadAsText(function (error, metadata, data) {
              if (!error && data) {
                var parsed = JSON.parse(data);
                vm.currentLibrary = parsed.library;
                if (parsed.current !== undefined) {
                  vm.currentBook = vm.currentLibrary.database[parsed.current];
                  vm.currentEpub = ePub(
                    vm.currentLibrary.information.fileprefix + vm.currentBook.file
                  );
                  vm.currentView = EbookReader;
                } else if (vm.currentLibrary.database.length === 0) {
                  vm.loadLibrary(defaultUrlLibrary);
                }
                document.getElementById("spinner").style.visibility = "hidden";
              }
            });
          } else {
            vm.loadLibrary(defaultUrlLibrary);
            vm.saveContextToJournal();
          }
        });
      }
    );

    // Handle resize
    window.addEventListener("resize", function () {
      vm.onResize();
    });

    // Handle unfullscreen button
    document.getElementById("unfullscreen-button").addEventListener("click", function () {
      vm.unfullscreen();
    });
  },

  updated: function () {
    if (this.currentView === EbookReader) {
      this.$refs.view.render(this.currentEpub, this.currentBook.location);
    }
  },

  methods: {
    localized: function () {
      this.$refs.toolbar.localized(this.$refs.localization);
      this.$refs.tutorial.localized(this.$refs.localization);
    },

    loadLibrary: function (url) {
      var vm = this;
      vm.currentLibrary = { database: [] };
      defaultUrlLibrary = url;
      document.getElementById("spinner").style.visibility = "visible";
      axios
        .get(url + "?lang=" + vm.$refs.localization.code)
        .then(function (response) {
          vm.currentLibrary = response.data;
          document.getElementById("spinner").style.visibility = "hidden";
          document.getElementById("cloudwarning").style.visibility = "hidden";
        })
        .catch(function () {
          document.getElementById("spinner").style.visibility = "hidden";
          document.getElementById("cloudwarning").style.visibility = "visible";
        });
    },

    saveContext: function () {
      if (this.currentView === EbookReader) {
        if (this.$refs.view.getLocation()) {
          this.currentBook.location = this.$refs.view.getLocation();
        }
      } else {
        this.currentLibrary = this.$refs.view.library;
      }
    },

    switchView: function () {
      this.saveContext();
      if (this.currentView === EbookReader) {
        this.currentView = LibraryViewer;
      } else if (this.currentBook) {
        this.currentView = EbookReader;
      }
    },

    showContents: function () {
      this.$refs.view.goToPage(this.currentEpub.contents);
    },

    fullscreen: function () {
      document.getElementById("main-toolbar").style.opacity = 0;
      document.getElementById("canvas").style.top = "0px";
      document.getElementById("unfullscreen-button").style.visibility = "visible";
      if (this.currentView === EbookReader) {
        var reader = this.$refs.view;
        reader.render(this.currentEpub, reader.getLocation());
      }
    },

    unfullscreen: function () {
      document.getElementById("main-toolbar").style.opacity = 1;
      document.getElementById("canvas").style.top = "55px";
      document.getElementById("unfullscreen-button").style.visibility = "hidden";
      if (this.currentView === EbookReader) {
        var reader = this.$refs.view;
        reader.render(this.currentEpub, reader.getLocation());
      }
    },

    setLibraryUrl: function () {
      var titleOk = this.$refs.localization.get("Ok"),
        titleCancel = this.$refs.localization.get("Cancel"),
        titleSettings = this.$refs.localization.get("Settings"),
        titleUrl = this.$refs.localization.get("Url");

      this.$refs.settings.show({
        content: `
          <div id='popup-toolbar' class='toolbar' style='padding: 0'>
            <button class='toolbutton pull-right' id='popup-ok-button' title='${titleOk}' style='outline:none;background-image: url(lib/sugar-web/graphics/icons/actions/dialog-ok.svg)'></button>
            <button class='toolbutton pull-right' id='popup-cancel-button' title='${titleCancel}' style='outline:none;background-image: url(lib/sugar-web/graphics/icons/actions/dialog-cancel.svg)'></button>
            <div style='position: absolute; top: 20px; left: 60px;'>${titleSettings}</div>
          </div>
          <div id='popup-container' style='width: 100%; overflow:auto'>
            <div class='popup-label'>${titleUrl}</div>
            <input id='input' class='popup-input'/>
          </div>
        `,
        closeButton: false,
        modalStyles: { backgroundColor: "white", height: "160px", width: "600px", maxWidth: "90%" },
      });
    },

    settingsShown: function () {
      var vm = this;
      document.getElementById("popup-container").style.height =
        document.getElementById("popup-toolbar").parentNode.offsetHeight - 110 + "px";
      document.getElementById("popup-ok-button").addEventListener("click", function () {
        vm.$refs.settings.close(true);
      });
      document.getElementById("popup-cancel-button").addEventListener("click", function () {
        vm.$refs.settings.close();
      });
      document.getElementById("input").value = defaultUrlLibrary;
    },

    settingsClosed: function (result) {
      if (result) {
        this.loadLibrary(document.getElementById("input").value);
      }
      this.$refs.settings.destroy();
    },

    onBookSelected: function (book) {
      if (this.currentView === LibraryViewer) {
        var vm = this;
        vm.currentBook = book;
        Vue.set(book, "spinner", true);
        vm.currentEpub = new ePub.Book();
        var xhr = new XMLHttpRequest();
        xhr.open(
          "GET",
          vm.currentLibrary.information.fileprefix + vm.currentBook.file,
          true
        );
        xhr.responseType = "arraybuffer";
        xhr.onload = function () {
          vm.currentEpub.open(this.response).then(
            function () {
              vm.currentEpub.loaded.navigation.then(function (sections) {
                sections.forEach(function (section) {
                  if (section.label.toUpperCase().trim() === "CONTENTS") {
                    vm.currentEpub.contents = section.href;
                  }
                });
              });
              vm.currentView = EbookReader;
              book.spinner = false;

              // Firefox internal hyperlink fix
              const readerContainer = document.getElementById("reader");
              if (readerContainer) {
                readerContainer.addEventListener("click", function (e) {
                  const target = e.target;
                  if (target.tagName === "A" && target.getAttribute("href").startsWith("#")) {
                    e.preventDefault();
                    const targetId = target.getAttribute("href").substring(1);
                    const targetEl = document.getElementById(targetId);
                    if (targetEl) targetEl.scrollIntoView({ behavior: "smooth" });
                  }
                });
              }
            },
            function () {
              console.log(
                "Error loading " + vm.currentLibrary.information.fileprefix + vm.currentBook.file
              );
              book.spinner = false;
            }
          );
        };
        xhr.send();
      }
    },

    onResize: function () {
      var vm = this;
      if (vm.currentView === EbookReader) {
        var reader = vm.$refs.view;
        if (this.timer) window.clearTimeout(this.timer);
        this.timer = window.setTimeout(function () {
          vm.currentBook.location = reader.getLocation();
          reader.render(vm.currentEpub, vm.currentBook.location);
          this.timer = null;
        }, 500);
      }
    },

    onHelp: function () {
      var options = {};
      options.switchbutton = this.$refs.toolbar.$refs.switchbutton.$el;
      options.contentsbutton = this.$refs.toolbar.$refs.contentsbutton
        ? this.$refs.toolbar.$refs.contentsbutton.$el
        : null;
      options.settingsbutton = this.$refs.toolbar.$refs.settings.$el;
      options.fullscreenbutton = this.$refs.toolbar.$refs.fullscreen.$el;
      if (this.currentView === LibraryViewer && this.$refs.view.$refs.item0 && this.$refs.view.$refs.item0[0]) {
        options.book = this.$refs.view.$refs.item0[0].$el;
      } else if (this.currentView === EbookReader) {
        options.prevbutton = document.getElementById("left");
        options.nextbutton = document.getElementById("right");
      }
      this.$refs.tutorial.show(options);
    },

    saveContextToJournal: function () {
      var vm = this;
      vm.saveContext();
      requirejs(["sugar-web/activity/activity"], function (activity) {
        console.log("writing...");
        var context = {
          library: { information: vm.currentLibrary.information, database: vm.currentLibrary.database },
        };
        if (vm.currentView === EbookReader) context.current = vm.currentLibrary.database.indexOf(vm.currentBook);
        var jsonData = JSON.stringify(context);
        activity.getDatastoreObject().setDataAsText(jsonData);
        activity.getDatastoreObject().save(function (error) {
          if (!error) console.log("write done.");
          else console.log("write failed.");
        });
      });
    },

    onStop: function () {
      this.saveContextToJournal();
    },
  },
});
