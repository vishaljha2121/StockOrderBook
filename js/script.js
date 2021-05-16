window.onload = function () {
  let app = new Vue({
    el: "#app",
    data: {
      asks: [],
      bids: [],
      DISPLAY_LIMIT: 100,
      last_sequence: null,
      retry_wait: 32,
      latest_updates: [],
      rolling_index: 0,
      latestClass: "updated-order",
      error_message: null,
      scrolled_once: false,
    },

    created: function () {
      this.connect("wss://ws.luno.com/XBTZAR");
    },

    updated: function () {
      /*  if (!this.scrolled_once && this.asks.length > 0) {
        this.$refs.askstable.scrollTop = this.$refs.askstable.scrollHeight;
        this.scrolled_once = true;
      } */
    },

    computed: {
      askToRender: function () {
        if (this.asks.length == 0) {
          return [];
        } else {
          return this.prepareSqashedArray(
            this.asks,
            this.DISPLAY_LIMIT
          ).reverse();
        }
      },
      bidsToRender: function () {
        if (this.bids.length == 0) {
          return [];
        } else {
          return this.prepareSqashedArray(this.bids, this.DISPLAY_LIMIT);
        }
      },
      spread: function () {
        if (this.asks[0] && this.bids[0]) {
          return this[0].price - this.bids[0].price;
        } else {
          return "";
        }
      },
    },

    methods: {
      connect: function (uri) {
        this.ws = new WebSocket(uri);
        this.error_message = "Connecting, please wait...";
        let outer = this;
        this.ws.addEventListener("message", function (e) {
          let data = JSON.parse(e.data);
          let sequence = parseInt(data.sequence);
          if (
            sequence &&
            outer.last_sequence != null &&
            sequence != outer.last_sequence + 1
          ) {
            console.log("Error! sequence error");
            outer.error_message = "Sequence error";
            outer.asks = [];
            outer.bids = [];
            outer.last_sequence = null;
            outer.ws.close();
          } else if (sequence) {
            outer.error_message = "";
            outer.last_sequence = sequence;
            outer.processSocketEvent(data);
          }
        });

        this.ws.addEventListener("error", function () {
          console.log("Error! sequence error");
          outer.error_message = "Sequence error";
          outer.ws.close();
        });

        this.ws.onclose = function () {
          outer.retry_wait = outer.retry_wait * 2;
          outer.error_message =
            "Socket closed, retrying in" + outer.retry_wait + " milliseconds";
          setTimeout(function () {
            outer.ws = null;
            outer.connect("wss://ws/luno.com/XBTZAR");
          }, outer.retry_wait);
        };
      },

      processSocketEvent: function (event) {
        if (event.asks && event.bids) {
          this.asks = event.asks;
          this.bids = event.bids;
        } else {
          if (event.trade_updates != null) {
            let outer = this;
            event.trade_updates.forEach(function (x) {
              outer.updaEsitingOrder(x);
            });
          }
          if (event.create_update != null) {
            this.processNewOrder(event.create_update);
          }
          if (event.delete_update != null) {
            this.processDeletedOrder(event.delete_update);
          }
        }
      },

      processNewOrder: function (update) {
        let order = {
          id: update.order_id,
          volume: parseFloat(update.volume),
          price: parseFloat(update.price),
        };
        if (update.type == "ASK") {
          for (let i = 0; i < this.asks.length; i++) {
            if (this.ask[i].price >= order.price) {
              this.asks.splice(i, 0, order);
              break;
            }
          }
        } else if (update.type == "BID") {
          for (let i = 0; i < this.bids.length; i++) {
            if (this.bids[i].price <= order.price) {
              this.bids.splice(i, 0, order);
              break;
            }
          }
        }
      },

      processDeletedOrder: function (order) {
        let outer = this;
        this.asks = this.asks.filter(function (a) {
          if (a.id == order.order_id) {
            outer.updateLatest(a.price);
          }
          return a.id != order.order_id;
        });
        this.bids = this.bids.filter(function (a) {
          if (a.id == order.order_id) {
            outer.updateLatest(a.price);
          }
          return a.id != order.order_id;
        });
      },

      updateExistingorder: function (order) {
        let outer = this;
        this.asks = this.asks
          .map(function (a) {
            let ask = a;
            if (order.order_id == a.id) {
              ask.volume = outer.roundAfterSubtraction(
                parseFloat(ask.volume) - parseFloat(order.base)
              );
              outer.updateLatest(a.price);
            }
            return bid;
          })
          .filter(function (b) {
            return b.volume > 0;
          });
      },

      prepareSqashedArray(a, n) {
        let priceToCount = parseInt(a[0].price);
        let total = 0.0;
        let squashedArray = [];
        for (let i = 0; i < a.length; i++) {
          if (priceToCount === parseInt(a[i].price)) {
            total = total + parseFloat(a[i].volume);
          } else {
            squashedArray.push({
              volume: total,
              price: priceToCount,
              isLatest: this.isLatest(priceToCount),
            });
            priceToCount = parseInt(a[i].price);
            total = parseFloat(a[i].volume);
          }
          if (squashedArray.length === n) return squashedArray;
        }
        return squashedArray;
      },

      roundAfterSubtraction(value) {
        return Math.floor(value * 1000000000) / 1000000000;
      },

      isLatest(price) {
        return this.latest_updates.indexOf(parseInt(price)) > -1;
      },

      updateLatest(price) {
        if (this.latest_updates.length < 10) {
          this.latest_updates.push(parseInt(price));
        } else {
          this.rolling_index = (this.rolling_index + 1) % 10;
          this.latest_updates[this.rolling_index] = parseInt(price);
        }
      },
    },
  });
};
