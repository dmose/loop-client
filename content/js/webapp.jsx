/** @jsx React.DOM */

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

/* global loop:true, React, MozActivity */
/* jshint newcap:false, maxlen:false */

var loop = loop || {};
loop.webapp = (function($, _, OT, mozL10n) {
  "use strict";

  loop.config = loop.config || {};
  loop.config.serverUrl = loop.config.serverUrl || "http://localhost:5000";

  var sharedActions = loop.shared.actions;
  var sharedMixins = loop.shared.mixins;
  var sharedModels = loop.shared.models;
  var sharedViews = loop.shared.views;
  var sharedUtils = loop.shared.utils;
  var WEBSOCKET_REASONS = loop.shared.utils.WEBSOCKET_REASONS;

  var multiplexGum = loop.standaloneMedia.multiplexGum;

  /**
   * Homepage view.
   */
  var HomeView = React.createClass({
    render: function() {
      multiplexGum.reset();
      return (
        <p>{mozL10n.get("welcome", {clientShortname: mozL10n.get("clientShortname2")})}</p>
      );
    }
  });

  /**
   * Unsupported Browsers view.
   */
  var UnsupportedBrowserView = React.createClass({
    render: function() {
      return (
        <div className="expired-url-info">
          <div className="info-panel">
            <div className="firefox-logo" />
            <h1>{mozL10n.get("incompatible_browser_heading")}</h1>
            <h4>{mozL10n.get("incompatible_browser_message")}</h4>
          </div>
          <PromoteFirefoxView helper={this.props.helper} />
        </div>
      );
    }
  });

  /**
   * Unsupported Device view.
   */
  var UnsupportedDeviceView = React.createClass({
    render: function() {
      return (
        <div>
          <h2>{mozL10n.get("incompatible_device")}</h2>
          <p>{mozL10n.get("sorry_device_unsupported", {clientShortname: mozL10n.get("clientShortname2")})}</p>
          <p>{mozL10n.get("use_firefox_windows_mac_linux", {brandShortname: mozL10n.get("brandShortname")})}</p>
        </div>
      );
    }
  });

  /**
   * Firefox promotion interstitial. Will display only to non-Firefox users.
   */
  var PromoteFirefoxView = React.createClass({
    propTypes: {
      helper: React.PropTypes.object.isRequired
    },

    render: function() {
      if (this.props.helper.isFirefox(navigator.userAgent)) {
        return <div />;
      }
      return (
        <div className="promote-firefox">
          <h3>{mozL10n.get("promote_firefox_hello_heading", {brandShortname: mozL10n.get("brandShortname")})}</h3>
          <p>
            <a className="btn btn-large btn-accept"
               href={loop.config.brandWebsiteUrl}>
              {mozL10n.get("get_firefox_button", {
                brandShortname: mozL10n.get("brandShortname")
              })}
            </a>
          </p>
        </div>
      );
    }
  });

  /**
   * Expired call URL view.
   */
  var CallUrlExpiredView = React.createClass({
    propTypes: {
      helper: React.PropTypes.object.isRequired
    },

    render: function() {
      return (
        <div className="expired-url-info">
          <div className="info-panel">
            <div className="firefox-logo" />
            <h1>{mozL10n.get("call_url_unavailable_notification_heading")}</h1>
            <h4>{mozL10n.get("call_url_unavailable_notification_message2")}</h4>
          </div>
          <PromoteFirefoxView helper={this.props.helper} />
        </div>
      );
    }
  });

  var ConversationBranding = React.createClass({
    render: function() {
      return (
        <h1 className="standalone-header-title">
          <strong>{mozL10n.get("clientShortname2")}</strong>
        </h1>
      );
    }
  });

  var FxOSConversationModel = Backbone.Model.extend({
    setupOutgoingCall: function(selectedCallType) {
      if (selectedCallType) {
        this.set("selectedCallType", selectedCallType);
      }
      // The FxOS Loop client exposes a "loop-call" activity. If we get the
      // activity onerror callback it means that there is no "loop-call"
      // activity handler available and so no FxOS Loop client installed.
      var request = new MozActivity({
        name: "loop-call",
        data: {
          type: "loop/token",
          token: this.get("loopToken"),
          callerId: this.get("callerId"),
          video: this.get("selectedCallType") === "audio-video"
        }
      });

      request.onsuccess = function() {};

      request.onerror = (function(event) {
        if (event.target.error.name !== "NO_PROVIDER") {
          console.error ("Unexpected " + event.target.error.name);
          this.trigger("session:error", "fxos_app_needed", {
            fxosAppName: loop.config.fxosApp.name
          });
          return;
        }
        this.trigger("fxos:app-needed");
      }).bind(this);
    },

    onMarketplaceMessage: function(event) {
      var message = event.data;
      switch (message.name) {
        case "loaded":
          var marketplace = window.document.getElementById("marketplace");
          // Once we have it loaded, we request the installation of the FxOS
          // Loop client app. We will be receiving the result of this action
          // via postMessage from the child iframe.
          marketplace.contentWindow.postMessage({
            "name": "install-package",
            "data": {
              "product": {
                "name": loop.config.fxosApp.name,
                "manifest_url": loop.config.fxosApp.manifestUrl,
                "is_packaged": true
              }
            }
          }, "*");
          break;
        case "install-package":
          window.removeEventListener("message", this.onMarketplaceMessage);
          if (message.error) {
            console.error(message.error.error);
            this.trigger("session:error", "fxos_app_needed", {
              fxosAppName: loop.config.fxosApp.name
            });
            return;
          }
          // We installed the FxOS app \o/, so we can continue with the call
          // process.
          this.setupOutgoingCall();
          break;
      }
    }
  });

  var ConversationHeader = React.createClass({
    render: function() {
      var cx = React.addons.classSet;
      var conversationUrl = location.href;

      var urlCreationDateClasses = cx({
        "light-color-font": true,
        "call-url-date": true, /* Used as a handler in the tests */
        /*hidden until date is available*/
        "hide": !this.props.urlCreationDateString.length
      });

      var callUrlCreationDateString = mozL10n.get("call_url_creation_date_label", {
        "call_url_creation_date": this.props.urlCreationDateString
      });

      return (
        <header className="standalone-header header-box container-box">
          <ConversationBranding />
          <div className="loop-logo"
               title={mozL10n.get("client_alttext",
                                  {clientShortname: mozL10n.get("clientShortname2")})}></div>
          <h3 className="call-url">
            {conversationUrl}
          </h3>
          <h4 className={urlCreationDateClasses}>
            {callUrlCreationDateString}
          </h4>
        </header>
      );
    }
  });

  var ConversationFooter = React.createClass({
    render: function() {
      return (
        <div className="standalone-footer container-box">
          <div title={mozL10n.get("vendor_alttext",
                                  {vendorShortname: mozL10n.get("vendorShortname")})}
               className="footer-logo"></div>
          <div className="footer-external-links">
            <a target="_blank" href={loop.config.generalSupportUrl}>
              {mozL10n.get("support_link")}
            </a>
          </div>
        </div>
      );
    }
  });

  /**
   * A view for when conversations are pending, displays any messages
   * and an option cancel button.
   */
  var PendingConversationView = React.createClass({
    propTypes: {
      callState: React.PropTypes.string.isRequired,
      // If not supplied, the cancel button is not displayed.
      cancelCallback: React.PropTypes.func
    },

    render: function() {
      var cancelButtonClasses = React.addons.classSet({
        btn: true,
        "btn-large": true,
        "btn-cancel": true,
        hide: !this.props.cancelCallback
      });

      return (
        <div className="container">
          <div className="container-box">
            <header className="pending-header header-box">
              <ConversationBranding />
            </header>

            <div id="cameraPreview" />

            <div id="messages" />

            <p className="standalone-btn-label">
              {this.props.callState}
            </p>

            <div className="btn-pending-cancel-group btn-group">
              <div className="flex-padding-1" />
              <button className={cancelButtonClasses}
                      onClick={this.props.cancelCallback} >
                <span className="standalone-call-btn-text">
                  {mozL10n.get("initiate_call_cancel_button")}
                </span>
              </button>
              <div className="flex-padding-1" />
            </div>
          </div>
          <ConversationFooter />
        </div>
      );
    }
  });

  /**
   * View displayed whilst the get user media prompt is being displayed. Indicates
   * to the user to accept the prompt.
   */
  var GumPromptConversationView = React.createClass({
    render: function() {
      var callState = mozL10n.get("call_progress_getting_media_description", {
        clientShortname: mozL10n.get("clientShortname2")
      });
      document.title = mozL10n.get("standalone_title_with_status", {
        clientShortname: mozL10n.get("clientShortname2"),
        currentStatus: mozL10n.get("call_progress_getting_media_title")
      });

      return <PendingConversationView callState={callState}/>;
    }
  });

  /**
   * View displayed waiting for a call to be connected. Updates the display
   * once the websocket shows that the callee is being alerted.
   */
  var WaitingConversationView = React.createClass({
    mixins: [sharedMixins.AudioMixin],

    getInitialState: function() {
      return {
        callState: "connecting"
      };
    },

    propTypes: {
      websocket: React.PropTypes.instanceOf(loop.CallConnectionWebSocket)
                      .isRequired
    },

    componentDidMount: function() {
      this.play("connecting", {loop: true});
      this.props.websocket.listenTo(this.props.websocket, "progress:alerting",
                                    this._handleRingingProgress);
    },

    _handleRingingProgress: function() {
      this.play("ringtone", {loop: true});
      this.setState({callState: "ringing"});
    },

    _cancelOutgoingCall: function() {
      multiplexGum.reset();
      this.props.websocket.cancel();
    },

    render: function() {
      var callStateStringEntityName = "call_progress_" + this.state.callState + "_description";
      var callState = mozL10n.get(callStateStringEntityName);
      document.title = mozL10n.get("standalone_title_with_status",
                                   {clientShortname: mozL10n.get("clientShortname2"),
                                    currentStatus: mozL10n.get(callStateStringEntityName)});

      return (
        <PendingConversationView
          callState={callState}
          cancelCallback={this._cancelOutgoingCall}
        />
      );
    }
  });

  var InitiateCallButton = React.createClass({
    mixins: [sharedMixins.DropdownMenuMixin],

    propTypes: {
      caption: React.PropTypes.string.isRequired,
      startCall: React.PropTypes.func.isRequired,
      disabled: React.PropTypes.bool
    },

    getDefaultProps: function() {
      return {disabled: false};
    },

    render: function() {
      var dropdownMenuClasses = React.addons.classSet({
        "native-dropdown-large-parent": true,
        "standalone-dropdown-menu": true,
        "visually-hidden": !this.state.showMenu
      });
      var chevronClasses = React.addons.classSet({
        "btn-chevron": true,
        "disabled": this.props.disabled
      });
      return (
        <div className="standalone-btn-chevron-menu-group">
          <div className="btn-group-chevron">
            <div className="btn-group">
              <button className="btn btn-constrained btn-large btn-accept"
                      onClick={this.props.startCall("audio-video")}
                      disabled={this.props.disabled}
                      title={mozL10n.get("initiate_audio_video_call_tooltip2")}>
                <span className="standalone-call-btn-text">
                  {this.props.caption}
                </span>
                <span className="standalone-call-btn-video-icon" />
              </button>
              <div className={chevronClasses}
                   onClick={this.toggleDropdownMenu}>
              </div>
            </div>
            <ul className={dropdownMenuClasses}>
              <li>
                <button className="start-audio-only-call"
                        onClick={this.props.startCall("audio")}
                        disabled={this.props.disabled}>
                  {mozL10n.get("initiate_audio_call_button2")}
                </button>
              </li>
            </ul>
          </div>
        </div>
      );
    }
  });

  /**
   * Initiate conversation view.
   */
  var InitiateConversationView = React.createClass({
    mixins: [Backbone.Events],

    propTypes: {
      conversation: React.PropTypes.oneOfType([
                      React.PropTypes.instanceOf(sharedModels.ConversationModel),
                      React.PropTypes.instanceOf(FxOSConversationModel)
                    ]).isRequired,
      // XXX Check more tightly here when we start injecting window.loop.*
      notifications: React.PropTypes.object.isRequired,
      client: React.PropTypes.object.isRequired,
      title: React.PropTypes.string.isRequired,
      callButtonLabel: React.PropTypes.string.isRequired
    },

    getInitialState: function() {
      return {
        urlCreationDateString: '',
        disableCallButton: false
      };
    },

    componentDidMount: function() {
      this.listenTo(this.props.conversation,
                    "session:error", this._onSessionError);
      this.listenTo(this.props.conversation,
                    "fxos:app-needed", this._onFxOSAppNeeded);
      this.props.client.requestCallUrlInfo(
        this.props.conversation.get("loopToken"),
        this._setConversationTimestamp);
    },

    componentWillUnmount: function() {
      this.stopListening(this.props.conversation);
      localStorage.setItem("has-seen-tos", "true");
    },

    _onSessionError: function(error, l10nProps) {
      var errorL10n = error || "unable_retrieve_call_info";
      this.props.notifications.errorL10n(errorL10n, l10nProps);
      console.error(errorL10n);
    },

    _onFxOSAppNeeded: function() {
      this.setState({
        marketplaceSrc: loop.config.marketplaceUrl,
        onMarketplaceMessage: this.props.conversation.onMarketplaceMessage.bind(
          this.props.conversation
        )
      });
     },

    /**
     * Initiates the call.
     * Takes in a call type parameter "audio" or "audio-video" and returns
     * a function that initiates the call. React click handler requires a function
     * to be called when that event happenes.
     *
     * @param {string} User call type choice "audio" or "audio-video"
     */
    startCall: function(callType) {
      return function() {
        this.props.conversation.setupOutgoingCall(callType);
        this.setState({disableCallButton: true});
      }.bind(this);
    },

    _setConversationTimestamp: function(err, callUrlInfo) {
      if (err) {
        this.props.notifications.errorL10n("unable_retrieve_call_info");
      } else {
        this.setState({
          urlCreationDateString: sharedUtils.formatDate(callUrlInfo.urlCreationDate)
        });
      }
    },

    render: function() {
      var tosLinkName = mozL10n.get("terms_of_use_link_text");
      var privacyNoticeName = mozL10n.get("privacy_notice_link_text");

      var tosHTML = mozL10n.get("legal_text_and_links", {
        "clientShortname": mozL10n.get("clientShortname2"),
        "terms_of_use_url": "<a target=_blank href='" +
          loop.config.legalWebsiteUrl + "'>" +
          tosLinkName + "</a>",
        "privacy_notice_url": "<a target=_blank href='" +
          loop.config.privacyWebsiteUrl + "'>" + privacyNoticeName + "</a>"
      });

      var tosClasses = React.addons.classSet({
        "terms-service": true,
        hide: (localStorage.getItem("has-seen-tos") === "true")
      });

      return (
        <div className="container">
          <div className="container-box">

            <ConversationHeader
              urlCreationDateString={this.state.urlCreationDateString} />

            <p className="standalone-btn-label">
              {this.props.title}
            </p>

            <div id="messages"></div>

            <div className="btn-group">
              <div className="flex-padding-1" />
              <InitiateCallButton
                caption={this.props.callButtonLabel}
                disabled={this.state.disableCallButton}
                startCall={this.startCall}
              />
              <div className="flex-padding-1" />
            </div>

            <p className={tosClasses}
               dangerouslySetInnerHTML={{__html: tosHTML}}></p>
          </div>

          <loop.fxOSMarketplaceViews.FxOSHiddenMarketplaceView
            marketplaceSrc={this.state.marketplaceSrc}
            onMarketplaceMessage= {this.state.onMarketplaceMessage} />

          <ConversationFooter />
        </div>
      );
    }
  });

  /**
   * Ended conversation view.
   */
  var EndedConversationView = React.createClass({
    propTypes: {
      conversation: React.PropTypes.instanceOf(sharedModels.ConversationModel)
                         .isRequired,
      sdk: React.PropTypes.object.isRequired,
      feedbackStore: React.PropTypes.instanceOf(loop.store.FeedbackStore),
      onAfterFeedbackReceived: React.PropTypes.func.isRequired
    },

    render: function() {
      document.title = mozL10n.get("standalone_title_with_status",
                                   {clientShortname: mozL10n.get("clientShortname2"),
                                    currentStatus: mozL10n.get("status_conversation_ended")});
      return (
        <div className="ended-conversation">
          <sharedViews.FeedbackView
            feedbackStore={this.props.feedbackStore}
            onAfterFeedbackReceived={this.props.onAfterFeedbackReceived}
          />
          <sharedViews.ConversationView
            initiate={false}
            sdk={this.props.sdk}
            model={this.props.conversation}
            audio={{enabled: false, visible: false}}
            video={{enabled: false, visible: false}}
          />
        </div>
      );
    }
  });

  var StartConversationView = React.createClass({
    render: function() {
      document.title = mozL10n.get("clientShortname2");
      return <InitiateConversationView
        {...this.props}
        title={mozL10n.get("initiate_call_button_label2")}
        callButtonLabel={mozL10n.get("initiate_audio_video_call_button2")}
      />;
    }
  });

  var FailedConversationView = React.createClass({
    mixins: [sharedMixins.AudioMixin],

    componentDidMount: function() {
      this.play("failure");
    },

    render: function() {
      document.title = mozL10n.get("standalone_title_with_status",
                                   {clientShortname: mozL10n.get("clientShortname2"),
                                    currentStatus: mozL10n.get("status_error")});
      return <InitiateConversationView
        {...this.props}
        title={mozL10n.get("call_failed_title")}
        callButtonLabel={mozL10n.get("retry_call_button")} />;
    }
  });

  /**
   * This view manages the outgoing conversation views - from
   * call initiation through to the actual conversation and call end.
   *
   * At the moment, it does more than that, these parts need refactoring out.
   */
  var OutgoingConversationView = React.createClass({
    propTypes: {
      client: React.PropTypes.instanceOf(loop.StandaloneClient).isRequired,
      conversation: React.PropTypes.oneOfType([
        React.PropTypes.instanceOf(sharedModels.ConversationModel),
        React.PropTypes.instanceOf(FxOSConversationModel)
      ]).isRequired,
      helper: React.PropTypes.instanceOf(sharedUtils.Helper).isRequired,
      notifications: React.PropTypes.instanceOf(sharedModels.NotificationCollection)
                          .isRequired,
      sdk: React.PropTypes.object.isRequired,
      feedbackStore: React.PropTypes.instanceOf(loop.store.FeedbackStore)
    },

    getInitialState: function() {
      return {
        callStatus: "start"
      };
    },

    componentDidMount: function() {
      this.props.conversation.on("call:outgoing", this.startCall, this);
      this.props.conversation.on("call:outgoing:get-media-privs", this.getMediaPrivs, this);
      this.props.conversation.on("call:outgoing:setup", this.setupOutgoingCall, this);
      this.props.conversation.on("change:publishedStream", this._checkConnected, this);
      this.props.conversation.on("change:subscribedStream", this._checkConnected, this);
      this.props.conversation.on("session:ended", this._endCall, this);
      this.props.conversation.on("session:peer-hungup", this._onPeerHungup, this);
      this.props.conversation.on("session:network-disconnected", this._onNetworkDisconnected, this);
      this.props.conversation.on("session:connection-error", this._notifyError, this);
    },

    componentDidUnmount: function() {
      this.props.conversation.off(null, null, this);
    },

    shouldComponentUpdate: function(nextProps, nextState) {
      // Only rerender if current state has actually changed
      return nextState.callStatus !== this.state.callStatus;
    },

    resetCallStatus: function() {
      this.props.feedbackStore.dispatchAction(new sharedActions.FeedbackComplete());
      return function() {
        this.setState({callStatus: "start"});
      }.bind(this);
    },

    /**
     * Renders the conversation views.
     */
    render: function() {
      switch (this.state.callStatus) {
        case "start": {
          return (
            <StartConversationView
              conversation={this.props.conversation}
              notifications={this.props.notifications}
              client={this.props.client}
            />
          );
        }
        case "failure": {
          return (
            <FailedConversationView
              conversation={this.props.conversation}
              notifications={this.props.notifications}
              client={this.props.client}
            />
          );
        }
        case "gumPrompt": {
          return <GumPromptConversationView />;
        }
        case "pending": {
          return <WaitingConversationView websocket={this._websocket} />;
        }
        case "connected": {
          document.title = mozL10n.get("standalone_title_with_status",
                                       {clientShortname: mozL10n.get("clientShortname2"),
                                        currentStatus: mozL10n.get("status_in_conversation")});
          return (
            <sharedViews.ConversationView
              initiate={true}
              sdk={this.props.sdk}
              model={this.props.conversation}
              video={{enabled: this.props.conversation.hasVideoStream("outgoing")}}
            />
          );
        }
        case "end": {
          return (
            <EndedConversationView
              sdk={this.props.sdk}
              conversation={this.props.conversation}
              feedbackStore={this.props.feedbackStore}
              onAfterFeedbackReceived={this.resetCallStatus()}
            />
          );
        }
        case "expired": {
          return (
            <CallUrlExpiredView helper={this.props.helper} />
          );
        }
        default: {
          return <HomeView />;
        }
      }
    },

    /**
     * Notify the user that the connection was not possible
     * @param {{code: number, message: string}} error
     */
    _notifyError: function(error) {
      console.error(error);
      this.props.notifications.errorL10n("connection_error_see_console_notification");
      this.setState({callStatus: "end"});
    },

    /**
     * Peer hung up. Notifies the user and ends the call.
     *
     * Event properties:
     * - {String} connectionId: OT session id
     */
    _onPeerHungup: function() {
      this.props.notifications.warnL10n("peer_ended_conversation2");
      this.setState({callStatus: "end"});
    },

    /**
     * Network disconnected. Notifies the user and ends the call.
     */
    _onNetworkDisconnected: function() {
      this.props.notifications.warnL10n("network_disconnected");
      this.setState({callStatus: "end"});
    },

    /**
     * Starts the set up of a call, obtaining the required information from the
     * server.
     */
    setupOutgoingCall: function() {
      var loopToken = this.props.conversation.get("loopToken");
      if (!loopToken) {
        this.props.notifications.errorL10n("missing_conversation_info");
        this.setState({callStatus: "failure"});
      } else {
        var callType = this.props.conversation.get("selectedCallType");

        this.props.client.requestCallInfo(this.props.conversation.get("loopToken"),
                                          callType, function(err, sessionData) {
          if (err) {
            switch (err.errno) {
              // loop-server sends 404 + INVALID_TOKEN (errno 105) whenever a token is
              // missing OR expired; we treat this information as if the url is always
              // expired.
              case 105:
                this.setState({callStatus: "expired"});
                break;
              default:
                this.props.notifications.errorL10n("missing_conversation_info");
                this.setState({callStatus: "failure"});
                break;
            }
            return;
          }
          this.props.conversation.outgoing(sessionData);
        }.bind(this));
      }
    },

    /**
     * Asks the user for the media privileges, handling the result appropriately.
     */
    getMediaPrivs: function() {
      this.setState({callStatus: "gumPrompt"});
      multiplexGum.getPermsAndCacheMedia({audio:true, video:true},
        function(localStream) {
          this.props.conversation.gotMediaPrivs();
        }.bind(this),
        function(errorCode) {
          multiplexGum.reset();
          this.setState({callStatus: "failure"});
        }.bind(this)
      );
    },

    /**
     * Actually starts the call.
     */
    startCall: function() {
      var loopToken = this.props.conversation.get("loopToken");
      if (!loopToken) {
        this.props.notifications.errorL10n("missing_conversation_info");
        this.setState({callStatus: "failure"});
        return;
      }

      this._setupWebSocket();
      this.setState({callStatus: "pending"});
    },

    /**
     * Used to set up the web socket connection and navigate to the
     * call view if appropriate.
     *
     * @param {string} loopToken The session token to use.
     */
    _setupWebSocket: function() {
      this._websocket = new loop.CallConnectionWebSocket({
        url: this.props.conversation.get("progressURL"),
        websocketToken: this.props.conversation.get("websocketToken"),
        callId: this.props.conversation.get("callId"),
      });
      this._websocket.promiseConnect().then(function() {
      }.bind(this), function() {
        // XXX Not the ideal response, but bug 1047410 will be replacing
        // this by better "call failed" UI.
        this.props.notifications.errorL10n("cannot_start_call_session_not_ready");
        return;
      }.bind(this));

      this._websocket.on("progress", this._handleWebSocketProgress, this);
    },

    /**
     * Checks if the streams have been connected, and notifies the
     * websocket that the media is now connected.
     */
    _checkConnected: function() {
      // Check we've had both local and remote streams connected before
      // sending the media up message.
      if (this.props.conversation.streamsConnected()) {
        this._websocket.mediaUp();
      }
    },

    /**
     * Used to receive websocket progress and to determine how to handle
     * it if appropraite.
     */
    _handleWebSocketProgress: function(progressData) {
      switch(progressData.state) {
        case "connecting": {
          // We just go straight to the connected view as the media gets set up.
          this.setState({callStatus: "connected"});
          break;
        }
        case "terminated": {
          // At the moment, we show the same text regardless
          // of the terminated reason.
          this._handleCallTerminated(progressData.reason);
          break;
        }
      }
    },

    /**
     * Handles call rejection.
     *
     * @param {String} reason The reason the call was terminated (reject, busy,
     *                        timeout, cancel, media-fail, user-unknown, closed)
     */
    _handleCallTerminated: function(reason) {
      multiplexGum.reset();

      if (reason === WEBSOCKET_REASONS.CANCEL) {
        this.setState({callStatus: "start"});
        return;
      }
      // XXX later, we'll want to display more meaningfull messages (needs UX)
      this.props.notifications.errorL10n("call_timeout_notification_text");
      this.setState({callStatus: "failure"});
    },

    /**
     * Handles ending a call by resetting the view to the start state.
     */
    _endCall: function() {
      multiplexGum.reset();

      if (this.state.callStatus !== "failure") {
        this.setState({callStatus: "end"});
      }
    },
  });

  /**
   * Webapp Root View. This is the main, single, view that controls the display
   * of the webapp page.
   */
  var WebappRootView = React.createClass({

    mixins: [sharedMixins.UrlHashChangeMixin,
             sharedMixins.DocumentLocationMixin,
             Backbone.Events],

    propTypes: {
      client: React.PropTypes.instanceOf(loop.StandaloneClient).isRequired,
      conversation: React.PropTypes.oneOfType([
        React.PropTypes.instanceOf(sharedModels.ConversationModel),
        React.PropTypes.instanceOf(FxOSConversationModel)
      ]).isRequired,
      helper: React.PropTypes.instanceOf(sharedUtils.Helper).isRequired,
      notifications: React.PropTypes.instanceOf(sharedModels.NotificationCollection)
                          .isRequired,
      sdk: React.PropTypes.object.isRequired,

      // XXX New types for flux style
      standaloneAppStore: React.PropTypes.instanceOf(
        loop.store.StandaloneAppStore).isRequired,
      activeRoomStore: React.PropTypes.oneOfType([
        React.PropTypes.instanceOf(loop.store.ActiveRoomStore),
        React.PropTypes.instanceOf(loop.store.FxOSActiveRoomStore)
      ]).isRequired,
      dispatcher: React.PropTypes.instanceOf(loop.Dispatcher).isRequired,
      feedbackStore: React.PropTypes.instanceOf(loop.store.FeedbackStore)
    },

    getInitialState: function() {
      return this.props.standaloneAppStore.getStoreState();
    },

    componentWillMount: function() {
      this.listenTo(this.props.standaloneAppStore, "change", function() {
        this.setState(this.props.standaloneAppStore.getStoreState());
      }, this);
    },

    componentWillUnmount: function() {
      this.stopListening(this.props.standaloneAppStore);
    },

    onUrlHashChange: function() {
      this.locationReload();
    },

    render: function() {
      switch (this.state.windowType) {
        case "unsupportedDevice": {
          return <UnsupportedDeviceView />;
        }
        case "unsupportedBrowser": {
          return <UnsupportedBrowserView helper={this.props.helper}/>;
        }
        case "outgoing": {
          return (
            <OutgoingConversationView
               client={this.props.client}
               conversation={this.props.conversation}
               helper={this.props.helper}
               notifications={this.props.notifications}
               sdk={this.props.sdk}
               feedbackStore={this.props.feedbackStore}
            />
          );
        }
        case "room": {
          return (
            <loop.standaloneRoomViews.StandaloneRoomView
              activeRoomStore={this.props.activeRoomStore}
              feedbackStore={this.props.feedbackStore}
              dispatcher={this.props.dispatcher}
              helper={this.props.helper}
            />
          );
        }
        case "home": {
          return <HomeView />;
        }
        default: {
          // The state hasn't been initialised yet, so don't display
          // anything to avoid flicker.
          return null;
        }
      }
    }
  });

  /**
   * App initialization.
   */
  function init() {
    var helper = new sharedUtils.Helper();
    var standaloneMozLoop = new loop.StandaloneMozLoop({
      baseServerUrl: loop.config.serverUrl
    });

    // Older non-flux based items.
    var notifications = new sharedModels.NotificationCollection();

    var feedbackApiClient = new loop.FeedbackAPIClient(
      loop.config.feedbackApiUrl, {
        product: loop.config.feedbackProductName,
        user_agent: navigator.userAgent,
        url: document.location.origin
      });

    // New flux items.
    var dispatcher = new loop.Dispatcher();
    var client = new loop.StandaloneClient({
      baseServerUrl: loop.config.serverUrl
    });
    var sdkDriver = new loop.OTSdkDriver({
      dispatcher: dispatcher,
      sdk: OT
    });
    var conversation;
    var activeRoomStore;
    if (helper.isFirefoxOS(navigator.userAgent)) {
      if (loop.config.fxosApp) {
        conversation = new FxOSConversationModel();
        if (loop.config.fxosApp.rooms) {
          activeRoomStore = new loop.store.FxOSActiveRoomStore(dispatcher, {
          mozLoop: standaloneMozLoop
          });
        }
      }
    }

    conversation = conversation ||
      new sharedModels.ConversationModel({}, {
        sdk: OT
    });
    activeRoomStore = activeRoomStore ||
      new loop.store.ActiveRoomStore(dispatcher, {
        mozLoop: standaloneMozLoop,
        sdkDriver: sdkDriver
    });

    var feedbackClient = new loop.FeedbackAPIClient(
      loop.config.feedbackApiUrl, {
      product: loop.config.feedbackProductName,
      user_agent: navigator.userAgent,
      url: document.location.origin
    });

    // Stores
    var standaloneAppStore = new loop.store.StandaloneAppStore({
      conversation: conversation,
      dispatcher: dispatcher,
      helper: helper,
      sdk: OT
    });
    var feedbackStore = new loop.store.FeedbackStore(dispatcher, {
      feedbackClient: feedbackClient
    });

    window.addEventListener("unload", function() {
      dispatcher.dispatch(new sharedActions.WindowUnload());
    });

    React.render(<WebappRootView
      client={client}
      conversation={conversation}
      helper={helper}
      notifications={notifications}
      sdk={OT}
      feedbackStore={feedbackStore}
      standaloneAppStore={standaloneAppStore}
      activeRoomStore={activeRoomStore}
      dispatcher={dispatcher}
    />, document.querySelector("#main"));

    // Set the 'lang' and 'dir' attributes to <html> when the page is translated
    document.documentElement.lang = mozL10n.language.code;
    document.documentElement.dir = mozL10n.language.direction;
    document.title = mozL10n.get("clientShortname2");

    dispatcher.dispatch(new sharedActions.ExtractTokenInfo({
      // We pass the hash or the pathname - the hash was used for the original
      // urls, the pathname for later ones.
      windowPath: helper.locationData().hash || helper.locationData().pathname
    }));
  }

  return {
    CallUrlExpiredView: CallUrlExpiredView,
    PendingConversationView: PendingConversationView,
    GumPromptConversationView: GumPromptConversationView,
    WaitingConversationView: WaitingConversationView,
    StartConversationView: StartConversationView,
    FailedConversationView: FailedConversationView,
    OutgoingConversationView: OutgoingConversationView,
    EndedConversationView: EndedConversationView,
    HomeView: HomeView,
    UnsupportedBrowserView: UnsupportedBrowserView,
    UnsupportedDeviceView: UnsupportedDeviceView,
    init: init,
    PromoteFirefoxView: PromoteFirefoxView,
    WebappRootView: WebappRootView,
    FxOSConversationModel: FxOSConversationModel
  };
})(jQuery, _, window.OT, navigator.mozL10n);
