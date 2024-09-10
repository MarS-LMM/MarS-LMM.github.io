class SeedRandom {
    constructor(seed) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }

    next() {
        return this.seed = this.seed * 16807 % 2147483647;
    }

    // 返回[0,1)范围内的伪随机数
    nextFloat() {
        return (this.next() - 1) / 2147483646;
    }
}


/**
 * Adds minutes to a given UTC timestamp and returns the new timestamp.
 *
 * @param {number} utcTimestamp - The UTC timestamp in milliseconds.
 * @param {number} minutes - The number of minutes to add to the timestamp. Default is 1.
 * @returns {number} New UTC timestamp in milliseconds after adding `minutes` minute.
 */
function addMinute(utcTimestamp, minutes = 1) {
    utcTimestamp *= 1000;

    // Define one minute in milliseconds.
    const oneMinuteInMilliseconds = 60000;

    // Create a new Date object using the provided UTC timestamp.
    const date = new Date(utcTimestamp);

    // Add minutes to the date.
    const newDate = new Date(date.getTime() + minutes * oneMinuteInMilliseconds);

    // Return the UTC timestamp of the new date.
    return newDate.getTime() / 1000;
}

function convertToUnixTimestamp(datetimeStr) {
    // 解析日期时间字符串到 UTC 时间的毫秒数
    const utcTimestamp = Date.parse(datetimeStr);

    // 创建一个 Date 对象
    const date = new Date(utcTimestamp);

    // 获取时区偏差（以分钟为单位），并转换为毫秒
    const timezoneOffset = date.getTimezoneOffset() * 60000;

    // 计算本地时间的毫秒时间戳
    const localTimestamp = utcTimestamp - timezoneOffset;

    // 转换为 UNIX 时间戳（秒）
    const unixTimestamp = localTimestamp / 1000;

    return unixTimestamp;
}

/**
 *
 * @param {*} time
 * @returns Next business day. [[discarded]]
 */
function nextBusinessDay(time) {
    var d = new Date();
    d.setUTCFullYear(time.year);
    d.setUTCMonth(time.month - 1);
    d.setUTCDate(time.day + 1);
    d.setUTCHours(0, 0, 0, 0);
    return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
    };
}


function parseKlineData(klineData) {
    return klineData.map(item => ({
        time: convertToUnixTimestamp(new Date(item.time)),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume
    }));
}


function drawMainChart1(container, chartContainer, ground_truth_kline_url, rollout_kline_url, lob_snapshot_url) {
    const chartOptions = {
        width: 1000,
        height: 450,
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
            tickMarkFormatter: (time, tickMarkType, locale) => {
                const date = new Date(time * 1000);
                var minutes = date.getUTCMinutes();
                var dateString = date.getUTCHours() + ':' + (minutes < 10 ? '0' + minutes : minutes);
                if (dateString.indexOf('13:00') >= 0) {
                    dateString = '11:30|13:00'
                }
                return dateString;
            }
        }
    };
    const chart = LightweightCharts.createChart(chartContainer, chartOptions);

    var candleSeries = chart.addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: true,
        wickUpColor: '#0A6847',
        wickDownColor: '#A91D3A',
    });
    candleSeries.priceScale().applyOptions({
        scaleMargins: {
            // positioning the price scale for the area series
            top: 0.1,
            bottom: 0.4,
        },
    });

    // Load ground truth kline data.
    // 把 groundKlineData 作为初始数据，且支持 push.
    let displayedData;
    fetch(ground_truth_kline_url)
        .then(response => response.json())
        .then(data => {
            console.log("Ground truth data loaded:", data); // Debugging line
            displayedData = parseKlineData(data);
            console.log("Parsed ground truth data:", displayedData); // Debugging line
            // Initialize chart with data if available
            if (displayedData.length > 0) {
                candleSeries.setData(displayedData.map(item => ({
                    time: item.time,
                    open: item.open,
                    high: item.high,
                    low: item.low,
                    close: item.close
                })));
            }
        })
        .catch(error => console.error("Error loading ground truth data:", error));


    // Load from json file.
    let klineData;
    fetch(rollout_kline_url)
        .then(response => response.json())
        .then(data => {
            klineData = data;
            klineData = parseKlineData(klineData);
            console.log(klineData);
        })
        .catch(error => console.error(error));

    let currentIndex = 0;
    const volumeSeries = chart.addHistogramSeries({
        color: '#26a69a',
        priceFormat: {
            type: 'volume',
        },
        priceScaleId: 'volume',
    });
    volumeSeries.priceScale().applyOptions({
        scaleMargins: {
            top: 0.75,
            bottom: 0,
        },
    });

    let cycle = 6;
    function updateChart() {
        if (currentIndex >= klineData.length) {
            clearInterval(chartIntervalId);
            return;
        }

        console.log("displayedData:", displayedData);
        if (currentIndex % cycle === 0) {
            displayedData.push(klineData[currentIndex]);
        } else {
            // 直接修改最后一个元素.
            displayedData[displayedData.length - 1] = klineData[currentIndex];
        }

        const candleData = displayedData.map(item => ({
            time: item.time,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close
        }));

        const volumeData = displayedData.map(item => ({
            time: item.time,
            value: item.volume,
            color: item.close > item.open ? '#26a69a' : '#ef5350'
        }));

        candleSeries.setData(candleData);
        volumeSeries.setData(volumeData);

        chart.timeScale().setVisibleRange({
            from: candleData[0].time, // 起始时间戳
            to: candleData[candleData.length - 1].time // 结束时间戳
        });

        currentIndex++;

    }

    const chartIntervalId = setInterval(updateChart, 600);

    const bidsContainer = container.querySelector('#bids');
    const asksContainer = container.querySelector('#asks');
    console.log("Print:", container, bidsContainer, asksContainer);
    // var orderbookIntervalId = setInterval(updateOrderbook, 1000, bidsContainer, asksContainer, 62);


    // Load from json file.
    let lob_snapshots;
    fetch(lob_snapshot_url)
        .then(response => response.json())
        .then(data => {
            lob_snapshots = data;
            console.log(lob_snapshots);
        })
        .catch(error => console.error(error));

    let lobIndex = 0;
    function updateOrderbookMain() {
        if (lobIndex >= lob_snapshots.length) {
            clearInterval(orderbookIntervalId);
            return;
        }

        const lob_snapshot = lob_snapshots[lobIndex];

        const ask_price = lob_snapshot.ask_price;
        const ask_volume = lob_snapshot.ask_volume;
        const bid_price = lob_snapshot.bid_price;
        const bid_volume = lob_snapshot.bid_volume;

        const asks = ask_price.map((price, index) => ({
            // price 保留两位小数，以 0 补齐
            price: price.toFixed(2),
            volume: ask_volume[index]
        }));
        for (let i = asks.length; i < 5; i++) {
            asks.push({
                price: '---',
                volume: '-----'
            });
        }


        const bids = bid_price.map((price, index) => ({
            price: price.toFixed(2),
            volume: bid_volume[index]
        }));
        for (let i = bids.length; i < 5; i++) {
            bids.push({
                price: '---',
                volume: '-----'
            });
        }

        // Reverse the asks.
        asks.reverse();
        console.log(asks, bids);
        bidsContainer.innerHTML = bids.map(bid => `<tr><td class="bid-level price-col">${bid.price}</td><td class="volume-col">${bid.volume}</td></tr>`).join('');
        asksContainer.innerHTML = asks.map(ask => `<tr><td class="ask-level price-col">${ask.price}</td><td class="volume-col">${ask.volume}</td></tr>`).join('');

        lobIndex++;
    }

    const orderbookIntervalId = setInterval(updateOrderbookMain, 600);


    return {
        chartIntervalId: chartIntervalId,
        orderbookIntervalId: orderbookIntervalId
    };
}
