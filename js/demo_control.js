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
            displayedData = data;
            displayedData = parseKlineData(displayedData);
            // console.log("groundKlineData:", groundKlineData);
        })
        .catch(error => console.error(error));
    
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

    const chartIntervalId = setInterval(updateChart, 1000);

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

    const orderbookIntervalId = setInterval(updateOrderbookMain, 1000);


    return {
        chartIntervalId: chartIntervalId,
        orderbookIntervalId: orderbookIntervalId
    };
}

function drawMainChart2(container, chartContainer, ground_truth_kline_url, rollout_kline_url, lob_snapshot_url) {
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
                displayedData = data;
                displayedData = parseKlineData(displayedData);
                // console.log("groundKlineData:", groundKlineData);
            })
            .catch(error => console.error(error));
        
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
    
        const chartIntervalId = setInterval(updateChart, 1000);
    
        const bidsContainer = container.querySelector('#bid');
        const asksContainer = container.querySelector('#ask');
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
    
        const orderbookIntervalId = setInterval(updateOrderbookMain, 1000);
    
    
        return {
            chartIntervalId: chartIntervalId,
            orderbookIntervalId: orderbookIntervalId
        };
    }

function static_chart(container) {
    var width = 800;
    var height = 450;


    var data = [
        {
            time: "2018-03-28",
            value: 21.00
    }, {
            time: "2018-03-29",
            value: 20.80
    }, {
            time: "2018-03-30",
            value: 19.40
    }, {
            time: "2018-04-02",
            value: 18.75
    }, {
            time: "2018-04-03",
            value: 18.75
    }, {
            time: "2018-04-04",
            value: 18.95
    }, {
            time: "2018-04-05",
            value: 16.95
    }, {
            time: "2018-04-06",
            value: 17.70
    }, {
            time: "2018-04-09",
            value: 31.00
    }, {
            time: "2018-04-10",
            value: 30.20
    }, {
            time: "2018-04-11",
            value: 31.50
    }, {
            time: "2018-04-12",
            value: 27.95
    }, {
            time: "2018-04-13",
            value: 30.15
    }, {
            time: "2018-04-16",
            value: 29.60
    }, {
            time: "2018-04-17",
            value: 27.70
    }, {
            time: "2018-04-18",
            value: 21.45
    }, {
            time: "2018-04-19",
            value: 24.05
    }, {
            time: "2018-04-20",
            value: 25.60
    }, {
            time: "2018-04-23",
            value: 26.50
    }, {
            time: "2018-04-24",
            value: 28.40
    }, {
            time: "2018-04-25",
            value: 30.55
    }, {
            time: "2018-04-26",
            value: 29.40
    }, {
            time: "2018-04-27",
            value: 30.70
    }, {
            time: "2018-04-30",
            value: 31.00
    }, {
            time: "2018-05-02",
            value: 27.70
    }, {
            time: "2018-05-03",
            value: 30.80
    }, {
            time: "2018-05-04",
            value: 33.35
    }, {
            time: "2018-05-07",
            value: 33.10
    }, {
            time: "2018-05-08",
            value: 34.60
    }, {
            time: "2018-05-10",
            value: 35.20
    }, {
            time: "2018-05-11",
            value: 37.50
    }, {
            time: "2018-05-14",
            value: 38.85
    }, {
            time: "2018-05-15",
            value: 37.00
    }, {
            time: "2018-05-16",
            value: 37.05
    }, {
            time: "2018-05-17",
            value: 37.05
    }, {
            time: "2018-05-18",
            value: 38.25
    }, {
            time: "2018-05-21",
            value: 38.80
    }, {
            time: "2018-05-22",
            value: 40.00
    }, {
            time: "2018-05-23",
            value: 42.45
    }, {
            time: "2018-05-24",
            value: 42.30
    }, {
            time: "2018-05-25",
            value: 42.80
    }, {
            time: "2018-05-28",
            value: 43.45
    }, {
            time: "2018-05-29",
            value: 43.15
    }, {
            time: "2018-05-30",
            value: 35.15
    }, {
            time: "2018-05-31",
            value: 34.20
    }, {
            time: "2018-06-01",
            value: 35.35
    }, {
            time: "2018-06-04",
            value: 37.90
    }, {
            time: "2018-06-05",
            value: 35.75
    }, {
            time: "2018-06-06",
            value: 33.70
    }, {
            time: "2018-06-07",
            value: 30.00
    }, {
            time: "2018-06-08",
            value: 31.10
    }, {
            time: "2018-06-11",
            value: 32.30
    }, {
            time: "2018-06-13",
            value: 30.95
    }, {
            time: "2018-06-14",
            value: 31.45
    }, {
            time: "2018-06-15",
            value: 34.50
    }, {
            time: "2018-06-18",
            value: 35.35
    }, {
            time: "2018-06-19",
            value: 37.00
    }, {
            time: "2018-06-20",
            value: 34.00
    }, {
            time: "2018-06-21",
            value: 34.45
    }, {
            time: "2018-06-22",
            value: 34.45
    }, {
            time: "2018-06-25",
            value: 34.25
    }, {
            time: "2018-06-26",
            value: 34.35
    }, {
            time: "2018-06-27",
            value: 33.85
    }, {
            time: "2018-06-28",
            value: 35.20
    }, {
            time: "2018-06-29",
            value: 35.20
    }, {
            time: "2018-07-02",
            value: 34.85
    }, {
            time: "2018-07-03",
            value: 31.95
    }, {
            time: "2018-07-04",
            value: 35.00
    }, {
            time: "2018-07-05",
            value: 45.80
    }, {
            time: "2018-07-06",
            value: 45.45
    }, {
            time: "2018-07-09",
            value: 46.70
    }, {
            time: "2018-07-10",
            value: 48.45
    }, {
            time: "2018-07-11",
            value: 50.70
    }, {
            time: "2018-07-12",
            value: 50.20
    }, {
            time: "2018-07-13",
            value: 51.75
    }, {
            time: "2018-07-16",
            value: 52.00
    }, {
            time: "2018-07-17",
            value: 50.75
    }, {
            time: "2018-07-18",
            value: 52.00
    }, {
            time: "2018-07-19",
            value: 54.00
    }, {
            time: "2018-07-20",
            value: 53.55
    }, {
            time: "2018-07-23",
            value: 51.20
    }, {
            time: "2018-07-24",
            value: 52.85
    }, {
            time: "2018-07-25",
            value: 53.70
    }, {
            time: "2018-07-26",
            value: 52.30
    }, {
            time: "2018-07-27",
            value: 52.80
    }, {
            time: "2018-07-30",
            value: 53.30
    }, {
            time: "2018-07-31",
            value: 52.05
    }, {
            time: "2018-08-01",
            value: 54.00
    }, {
            time: "2018-08-02",
            value: 59.00
    }, {
            time: "2018-08-03",
            value: 56.90
    }, {
            time: "2018-08-06",
            value: 60.70
    }, {
            time: "2018-08-07",
            value: 60.75
    }, {
            time: "2018-08-08",
            value: 63.15
    }, {
            time: "2018-08-09",
            value: 65.30
    }, {
            time: "2018-08-10",
            value: 70.00
    }, {
            time: "2018-08-13",
            value: 69.25
    }, {
            time: "2018-08-14",
            value: 67.75
    }, {
            time: "2018-08-15",
            value: 67.60
    }, {
            time: "2018-08-16",
            value: 64.50
    }, {
            time: "2018-08-17",
            value: 66.00
    }, {
            time: "2018-08-20",
            value: 66.05
    }, {
            time: "2018-08-21",
            value: 66.65
    }, {
            time: "2018-08-22",
            value: 66.40
    }, {
            time: "2018-08-23",
            value: 69.35
    }, {
            time: "2018-08-24",
            value: 70.55
    }, {
            time: "2018-08-27",
            value: 68.80
    }, {
            time: "2018-08-28",
            value: 68.45
    }, {
            time: "2018-08-29",
            value: 63.20
    }, {
            time: "2018-08-30",
            value: 59.50
    }, {
            time: "2018-08-31",
            value: 59.50
    }, {
            time: "2018-09-03",
            value: 60.45
    }, {
            time: "2018-09-04",
            value: 62.25
    }, {
            time: "2018-09-05",
            value: 63.50
    }, {
            time: "2018-09-06",
            value: 66.90
    }, {
            time: "2018-09-07",
            value: 66.45
    }, {
            time: "2018-09-10",
            value: 68.50
    }, {
            time: "2018-09-11",
            value: 69.90
    }, {
            time: "2018-09-12",
            value: 67.80
    }, {
            time: "2018-09-13",
            value: 67.90
    }, {
            time: "2018-09-14",
            value: 69.25
    }, {
            time: "2018-09-17",
            value: 68.95
    }, {
            time: "2018-09-18",
            value: 65.85
    }, {
            time: "2018-09-19",
            value: 63.60
    }, {
            time: "2018-09-20",
            value: 64.00
    }, {
            time: "2018-09-21",
            value: 64.00
    }, {
            time: "2018-09-24",
            value: 66.05
    }, {
            time: "2018-09-25",
            value: 68.35
    }, {
            time: "2018-09-26",
            value: 68.30
    }, {
            time: "2018-09-27",
            value: 67.95
    }, {
            time: "2018-09-28",
            value: 68.45
    }, {
            time: "2018-10-01",
            value: 68.80
    }, {
            time: "2018-10-02",
            value: 68.60
    }, {
            time: "2018-10-03",
            value: 67.90
    }, {
            time: "2018-10-04",
            value: 68.60
    }, {
            time: "2018-10-05",
            value: 70.35
    }, {
            time: "2018-10-08",
            value: 72.35
    }, {
            time: "2018-10-09",
            value: 72.90
    }, {
            time: "2018-10-10",
            value: 72.85
    }, {
            time: "2018-10-11",
            value: 74.10
    }, {
            time: "2018-10-12",
            value: 73.00
    }, {
            time: "2018-10-15",
            value: 74.85
    }, {
            time: "2018-10-16",
            value: 76.00
    }, {
            time: "2018-10-17",
            value: 77.00
    }, {
            time: "2018-10-18",
            value: 79.00
    }, {
            time: "2018-10-19",
            value: 79.50
    }, {
            time: "2018-10-22",
            value: 82.60
    }, {
            time: "2018-10-23",
            value: 82.70
    }, {
            time: "2018-10-24",
            value: 82.10
    }, {
            time: "2018-10-25",
            value: 83.15
    }, {
            time: "2018-10-26",
            value: 83.40
    }, {
            time: "2018-10-29",
            value: 80.95
    }, {
            time: "2018-10-30",
            value: 76.75
    }, {
            time: "2018-10-31",
            value: 77.75
    }, {
            time: "2018-11-01",
            value: 78.12
    }, {
            time: "2018-11-02",
            value: 73.22
    }, {
            time: "2018-11-06",
            value: 72.60
    }, {
            time: "2018-11-07",
            value: 74.40
    }, {
            time: "2018-11-08",
            value: 76.50
    }, {
            time: "2018-11-09",
            value: 79.86
    }, {
            time: "2018-11-12",
            value: 78.10
    }, {
            time: "2018-11-13",
            value: 77.60
    }, {
            time: "2018-11-14",
            value: 71.70
    }, {
            time: "2018-11-15",
            value: 72.26
    }, {
            time: "2018-11-16",
            value: 73.80
    }, {
            time: "2018-11-19",
            value: 76.28
    }, {
            time: "2018-11-20",
            value: 72.80
    }, {
            time: "2018-11-21",
            value: 66.20
    }, {
            time: "2018-11-22",
            value: 65.10
    }, {
            time: "2018-11-23",
            value: 61.26
    }, {
            time: "2018-11-26",
            value: 64.10
    }, {
            time: "2018-11-27",
            value: 61.72
    }, {
            time: "2018-11-28",
            value: 61.40
    }, {
            time: "2018-11-29",
            value: 61.86
    }, {
            time: "2018-11-30",
            value: 60.60
    }, {
            time: "2018-12-03",
            value: 63.16
    }, {
            time: "2018-12-04",
            value: 68.30
    }, {
            time: "2018-12-05",
            value: 67.20
    }, {
            time: "2018-12-06",
            value: 68.56
    }, {
            time: "2018-12-07",
            value: 71.30
    }, {
            time: "2018-12-10",
            value: 73.98
    }, {
            time: "2018-12-11",
            value: 72.28
    }, {
            time: "2018-12-12",
            value: 73.20
    }, {
            time: "2018-12-13",
            value: 73.00
    }, {
            time: "2018-12-14",
            value: 72.90
    }, {
            time: "2018-12-17",
            value: 73.96
    }, {
            time: "2018-12-18",
            value: 73.40
    }, {
            time: "2018-12-19",
            value: 73.00
    }, {
            time: "2018-12-20",
            value: 72.98
    }, {
            time: "2018-12-21",
            value: 72.80
    }, {
            time: "2018-12-24",
            value: 72.90
    }, {
            time: "2018-12-25",
            value: 74.20
    }, {
            time: "2018-12-26",
            value: 73.98
    }, {
            time: "2018-12-27",
            value: 74.50
    }, {
            time: "2018-12-28",
            value: 74.00
    }, {
            time: "2019-01-03",
            value: 73.50
    }, {
            time: "2019-01-04",
            value: 73.90
    }, {
            time: "2019-01-08",
            value: 73.90
    }, {
            time: "2019-01-09",
            value: 72.94
    }, {
            time: "2019-01-10",
            value: 69.86
    }, {
            time: "2019-01-11",
            value: 70.34
    }, {
            time: "2019-01-14",
            value: 68.78
    }, {
            time: "2019-01-15",
            value: 68.02
    }, {
            time: "2019-01-16",
            value: 66.60
    }, {
            time: "2019-01-17",
            value: 65.94
    }, {
            time: "2019-01-18",
            value: 68.00
    }, {
            time: "2019-01-21",
            value: 69.20
    }, {
            time: "2019-01-22",
            value: 69.76
    }, {
            time: "2019-01-23",
            value: 69.60
    }, {
            time: "2019-01-24",
            value: 69.62
    }, {
            time: "2019-01-25",
            value: 69.30
    }, {
            time: "2019-01-28",
            value: 69.20
    }, {
            time: "2019-01-29",
            value: 68.90
    }, {
            time: "2019-01-30",
            value: 66.40
    }, {
            time: "2019-01-31",
            value: 67.08
    }, {
            time: "2019-02-01",
            value: 69.78
    }, {
            time: "2019-02-04",
            value: 72.56
    }, {
            time: "2019-02-05",
            value: 72.74
    }, {
            time: "2019-02-06",
            value: 73.00
    }, {
            time: "2019-02-07",
            value: 73.38
    }, {
            time: "2019-02-08",
            value: 73.10
    }, {
            time: "2019-02-11",
            value: 73.22
    }, {
            time: "2019-02-12",
            value: 72.30
    }, {
            time: "2019-02-13",
            value: 74.86
    }, {
            time: "2019-02-14",
            value: 73.64
    }, {
            time: "2019-02-15",
            value: 73.38
    }, {
            time: "2019-02-18",
            value: 74.26
    }, {
            time: "2019-02-19",
            value: 75.00
    }, {
            time: "2019-02-20",
            value: 74.96
    }, {
            time: "2019-02-21",
            value: 75.00
    }, {
            time: "2019-02-22",
            value: 74.88
    }, {
            time: "2019-02-25",
            value: 74.96
    }, {
            time: "2019-02-26",
            value: 76.02
    }, {
            time: "2019-02-27",
            value: 77.30
    }, {
            time: "2019-02-28",
            value: 77.90
    }, {
            time: "2019-03-01",
            value: 78.24
    }, {
            time: "2019-03-04",
            value: 76.64
    }, {
            time: "2019-03-05",
            value: 78.74
    }, {
            time: "2019-03-06",
            value: 76.88
    }, {
            time: "2019-03-07",
            value: 75.32
    }, {
            time: "2019-03-11",
            value: 72.90
    }, {
            time: "2019-03-12",
            value: 74.78
    }, {
            time: "2019-03-13",
            value: 74.50
    }, {
            time: "2019-03-14",
            value: 75.34
    }, {
            time: "2019-03-15",
            value: 74.92
    }, {
            time: "2019-03-18",
            value: 75.08
    }, {
            time: "2019-03-19",
            value: 75.54
    }, {
            time: "2019-03-20",
            value: 76.78
    }, {
            time: "2019-03-21",
            value: 77.70
    }, {
            time: "2019-03-22",
            value: 77.34
    }, {
            time: "2019-03-25",
            value: 78.00
    }, {
            time: "2019-03-26",
            value: 77.98
    }, {
            time: "2019-03-27",
            value: 78.90
    }, {
            time: "2019-03-28",
            value: 78.30
    }, {
            time: "2019-03-29",
            value: 78.70
    }, {
            time: "2019-04-01",
            value: 77.22
    }, {
            time: "2019-04-02",
            value: 76.64
    }, {
            time: "2019-04-03",
            value: 76.50
    }, {
            time: "2019-04-04",
            value: 76.64
    }, {
            time: "2019-04-05",
            value: 75.46
    }, {
            time: "2019-04-08",
            value: 76.42
    }, {
            time: "2019-04-09",
            value: 77.76
    }, {
            time: "2019-04-10",
            value: 77.68
    }, {
            time: "2019-04-11",
            value: 76.60
    }, {
            time: "2019-04-12",
            value: 76.78
    }, {
            time: "2019-04-15",
            value: 76.28
    }, {
            time: "2019-04-16",
            value: 75.88
    }, {
            time: "2019-04-17",
            value: 76.38
    }, {
            time: "2019-04-18",
            value: 77.00
    }, {
            time: "2019-04-19",
            value: 77.40
    }, {
            time: "2019-04-22",
            value: 77.40
    }, {
            time: "2019-04-23",
            value: 78.20
    }, {
            time: "2019-04-24",
            value: 78.68
    }, {
            time: "2019-04-25",
            value: 78.66
    }, {
            time: "2019-04-26",
            value: 77.88
    }, {
            time: "2019-04-29",
            value: 78.02
    }, {
            time: "2019-04-30",
            value: 78.68
    }, {
            time: "2019-05-02",
            value: 78.14
    }, {
            time: "2019-05-03",
            value: 78.30
    }, {
            time: "2019-05-06",
            value: 80.06
    }, {
            time: "2019-05-07",
            value: 80.50
    }, {
            time: "2019-05-08",
            value: 80.76
    }, {
            time: "2019-05-10",
            value: 82.10
    }, {
            time: "2019-05-13",
            value: 83.72
    }, {
            time: "2019-05-14",
            value: 83.55
    }, {
            time: "2019-05-15",
            value: 84.92
    }, {
            time: "2019-05-16",
            value: 83.32
    }, {
            time: "2019-05-17",
            value: 83.04
    }, {
            time: "2019-05-20",
            value: 83.92
    }, {
            time: "2019-05-21",
            value: 84.24
    }, {
            time: "2019-05-22",
            value: 84.00
    }, {
            time: "2019-05-23",
            value: 84.26
    }, {
            time: "2019-05-24",
            value: 84.00
    }, {
            time: "2019-05-27",
            value: 83.80
    }, {
            time: "2019-05-28",
            value: 84.32
    }, {
            time: "2019-05-29",
            value: 83.88
    }, {
            time: "2019-05-30",
            value: 84.58
    }, {
            time: "2019-05-31",
            value: 81.20
    }, {
            time: "2019-06-03",
            value: 84.35
    }, {
            time: "2019-06-04",
            value: 85.66
    }, {
            time: "2019-06-05",
            value: 86.51
    }, ];

    var chart = window.tvchart = LightweightCharts.createChart(container, {
        width: width,
        height: height,
        layout: {
            background: {
                color: '#000000',
                // color: '#FFFFFF',
            },
            // lineColor: '#2B2B43',
            textColor: '#FFFFFF',
        },
        rightPriceScale: {
            scaleMargins: {
                top: 0.35,
                bottom: 0.2,
            },
            borderVisible: false,
        },
        timeScale: {
            borderVisible: false,
        },
        grid: {
            horzLines: {
                color: '#eee',
                visible: false,
            },
            vertLines: {
                color: '#ffffff',
                visible: false,
            },
        },
        crosshair: {
            horzLine: {
                visible: false,
                labelVisible: false
            },
            vertLine: {
                visible: true,
                style: 0,
                width: 2,
                // color: 'rgba(32, 38, 46, 0.1)',
                color: '#ffffff',
                labelVisible: false,
            }
        },
    });

    var series = chart.addAreaSeries({
        topColor: 'rgba(19, 68, 193, 0.4)',
        bottomColor: 'rgba(0, 120, 255, 0.0)',
        lineColor: 'rgba(19, 40, 153, 1.0)',
        lineWidth: 3
    });


    series.setData(data);
}


function drawDemo1V1(container, downloadButtonContainer) {
    var width = 800;
    var height = 450;


    var data = [
        {
            time: "2018-03-28",
            value: 21.00
    }, {
            time: "2018-03-29",
            value: 20.80
    }, {
            time: "2018-03-30",
            value: 19.40
    }, {
            time: "2018-04-02",
            value: 18.75
    }, {
            time: "2018-04-03",
            value: 18.75
    }, {
            time: "2018-04-04",
            value: 18.95
    }, {
            time: "2018-04-05",
            value: 16.95
    }, {
            time: "2018-04-06",
            value: 17.70
    }, {
            time: "2018-04-09",
            value: 31.00
    }, {
            time: "2018-04-10",
            value: 30.20
    }, {
            time: "2018-04-11",
            value: 31.50
    }, {
            time: "2018-04-12",
            value: 27.95
    }, {
            time: "2018-04-13",
            value: 30.15
    }, {
            time: "2018-04-16",
            value: 29.60
    }, {
            time: "2018-04-17",
            value: 27.70
    }, {
            time: "2018-04-18",
            value: 21.45
    }, {
            time: "2018-04-19",
            value: 24.05
    }, {
            time: "2018-04-20",
            value: 25.60
    }, {
            time: "2018-04-23",
            value: 26.50
    }, {
            time: "2018-04-24",
            value: 28.40
    }, {
            time: "2018-04-25",
            value: 30.55
    }, {
            time: "2018-04-26",
            value: 29.40
    }, {
            time: "2018-04-27",
            value: 30.70
    }, {
            time: "2018-04-30",
            value: 31.00
    }, {
            time: "2018-05-02",
            value: 27.70
    }, {
            time: "2018-05-03",
            value: 30.80
    }, {
            time: "2018-05-04",
            value: 33.35
    }, {
            time: "2018-05-07",
            value: 33.10
    }, {
            time: "2018-05-08",
            value: 34.60
    }, {
            time: "2018-05-10",
            value: 35.20
    }, {
            time: "2018-05-11",
            value: 37.50
    }, {
            time: "2018-05-14",
            value: 38.85
    }, {
            time: "2018-05-15",
            value: 37.00
    }, {
            time: "2018-05-16",
            value: 37.05
    }, {
            time: "2018-05-17",
            value: 37.05
    }, {
            time: "2018-05-18",
            value: 38.25
    }, {
            time: "2018-05-21",
            value: 38.80
    }, {
            time: "2018-05-22",
            value: 40.00
    }, {
            time: "2018-05-23",
            value: 42.45
    }, {
            time: "2018-05-24",
            value: 42.30
    }, {
            time: "2018-05-25",
            value: 42.80
    }, {
            time: "2018-05-28",
            value: 43.45
    }, {
            time: "2018-05-29",
            value: 43.15
    }, {
            time: "2018-05-30",
            value: 35.15
    }, {
            time: "2018-05-31",
            value: 34.20
    }, {
            time: "2018-06-01",
            value: 35.35
    }, {
            time: "2018-06-04",
            value: 37.90
    }, {
            time: "2018-06-05",
            value: 35.75
    }, {
            time: "2018-06-06",
            value: 33.70
    }, {
            time: "2018-06-07",
            value: 30.00
    }, {
            time: "2018-06-08",
            value: 31.10
    }, {
            time: "2018-06-11",
            value: 32.30
    }, {
            time: "2018-06-13",
            value: 30.95
    }, {
            time: "2018-06-14",
            value: 31.45
    }, {
            time: "2018-06-15",
            value: 34.50
    }, {
            time: "2018-06-18",
            value: 35.35
    }, {
            time: "2018-06-19",
            value: 37.00
    }, {
            time: "2018-06-20",
            value: 34.00
    }, {
            time: "2018-06-21",
            value: 34.45
    }, {
            time: "2018-06-22",
            value: 34.45
    }, {
            time: "2018-06-25",
            value: 34.25
    }, {
            time: "2018-06-26",
            value: 34.35
    }, {
            time: "2018-06-27",
            value: 33.85
    }, {
            time: "2018-06-28",
            value: 35.20
    }, {
            time: "2018-06-29",
            value: 35.20
    }, {
            time: "2018-07-02",
            value: 34.85
    }, {
            time: "2018-07-03",
            value: 31.95
    }, {
            time: "2018-07-04",
            value: 35.00
    }, {
            time: "2018-07-05",
            value: 45.80
    }, {
            time: "2018-07-06",
            value: 45.45
    }, {
            time: "2018-07-09",
            value: 46.70
    }, {
            time: "2018-07-10",
            value: 48.45
    }, {
            time: "2018-07-11",
            value: 50.70
    }, {
            time: "2018-07-12",
            value: 50.20
    }, {
            time: "2018-07-13",
            value: 51.75
    }, {
            time: "2018-07-16",
            value: 52.00
    }, {
            time: "2018-07-17",
            value: 50.75
    }, {
            time: "2018-07-18",
            value: 52.00
    }, {
            time: "2018-07-19",
            value: 54.00
    }, {
            time: "2018-07-20",
            value: 53.55
    }, {
            time: "2018-07-23",
            value: 51.20
    }, {
            time: "2018-07-24",
            value: 52.85
    }, {
            time: "2018-07-25",
            value: 53.70
    }, {
            time: "2018-07-26",
            value: 52.30
    }, {
            time: "2018-07-27",
            value: 52.80
    }, {
            time: "2018-07-30",
            value: 53.30
    }, {
            time: "2018-07-31",
            value: 52.05
    }, {
            time: "2018-08-01",
            value: 54.00
    }, {
            time: "2018-08-02",
            value: 59.00
    }, {
            time: "2018-08-03",
            value: 56.90
    }, {
            time: "2018-08-06",
            value: 60.70
    }, {
            time: "2018-08-07",
            value: 60.75
    }, {
            time: "2018-08-08",
            value: 63.15
    }, {
            time: "2018-08-09",
            value: 65.30
    }, {
            time: "2018-08-10",
            value: 70.00
    }, {
            time: "2018-08-13",
            value: 69.25
    }, {
            time: "2018-08-14",
            value: 67.75
    }, {
            time: "2018-08-15",
            value: 67.60
    }, {
            time: "2018-08-16",
            value: 64.50
    }, {
            time: "2018-08-17",
            value: 66.00
    }, {
            time: "2018-08-20",
            value: 66.05
    }, {
            time: "2018-08-21",
            value: 66.65
    }, {
            time: "2018-08-22",
            value: 66.40
    }, {
            time: "2018-08-23",
            value: 69.35
    }, {
            time: "2018-08-24",
            value: 70.55
    }, {
            time: "2018-08-27",
            value: 68.80
    }, {
            time: "2018-08-28",
            value: 68.45
    }, {
            time: "2018-08-29",
            value: 63.20
    }, {
            time: "2018-08-30",
            value: 59.50
    }, {
            time: "2018-08-31",
            value: 59.50
    }, {
            time: "2018-09-03",
            value: 60.45
    }, {
            time: "2018-09-04",
            value: 62.25
    }, {
            time: "2018-09-05",
            value: 63.50
    }, {
            time: "2018-09-06",
            value: 66.90
    }, {
            time: "2018-09-07",
            value: 66.45
    }, {
            time: "2018-09-10",
            value: 68.50
    }, {
            time: "2018-09-11",
            value: 69.90
    }, {
            time: "2018-09-12",
            value: 67.80
    }, {
            time: "2018-09-13",
            value: 67.90
    }, {
            time: "2018-09-14",
            value: 69.25
    }, {
            time: "2018-09-17",
            value: 68.95
    }, {
            time: "2018-09-18",
            value: 65.85
    }, {
            time: "2018-09-19",
            value: 63.60
    }, {
            time: "2018-09-20",
            value: 64.00
    }, {
            time: "2018-09-21",
            value: 64.00
    }, {
            time: "2018-09-24",
            value: 66.05
    }, {
            time: "2018-09-25",
            value: 68.35
    }, {
            time: "2018-09-26",
            value: 68.30
    }, {
            time: "2018-09-27",
            value: 67.95
    }, {
            time: "2018-09-28",
            value: 68.45
    }, {
            time: "2018-10-01",
            value: 68.80
    }, {
            time: "2018-10-02",
            value: 68.60
    }, {
            time: "2018-10-03",
            value: 67.90
    }, {
            time: "2018-10-04",
            value: 68.60
    }, {
            time: "2018-10-05",
            value: 70.35
    }, {
            time: "2018-10-08",
            value: 72.35
    }, {
            time: "2018-10-09",
            value: 72.90
    }, {
            time: "2018-10-10",
            value: 72.85
    }, {
            time: "2018-10-11",
            value: 74.10
    }, {
            time: "2018-10-12",
            value: 73.00
    }, {
            time: "2018-10-15",
            value: 74.85
    }, {
            time: "2018-10-16",
            value: 76.00
    }, {
            time: "2018-10-17",
            value: 77.00
    }, {
            time: "2018-10-18",
            value: 79.00
    }, {
            time: "2018-10-19",
            value: 79.50
    }, {
            time: "2018-10-22",
            value: 82.60
    }, {
            time: "2018-10-23",
            value: 82.70
    }, {
            time: "2018-10-24",
            value: 82.10
    }, {
            time: "2018-10-25",
            value: 83.15
    }, {
            time: "2018-10-26",
            value: 83.40
    }, {
            time: "2018-10-29",
            value: 80.95
    }, {
            time: "2018-10-30",
            value: 76.75
    }, {
            time: "2018-10-31",
            value: 77.75
    }, {
            time: "2018-11-01",
            value: 78.12
    }, {
            time: "2018-11-02",
            value: 73.22
    }, {
            time: "2018-11-06",
            value: 72.60
    }, {
            time: "2018-11-07",
            value: 74.40
    }, {
            time: "2018-11-08",
            value: 76.50
    }, {
            time: "2018-11-09",
            value: 79.86
    }, {
            time: "2018-11-12",
            value: 78.10
    }, {
            time: "2018-11-13",
            value: 77.60
    }, {
            time: "2018-11-14",
            value: 71.70
    }, {
            time: "2018-11-15",
            value: 72.26
    }, {
            time: "2018-11-16",
            value: 73.80
    }, {
            time: "2018-11-19",
            value: 76.28
    }, {
            time: "2018-11-20",
            value: 72.80
    }, {
            time: "2018-11-21",
            value: 66.20
    }, {
            time: "2018-11-22",
            value: 65.10
    }, {
            time: "2018-11-23",
            value: 61.26
    }, {
            time: "2018-11-26",
            value: 64.10
    }, {
            time: "2018-11-27",
            value: 61.72
    }, {
            time: "2018-11-28",
            value: 61.40
    }, {
            time: "2018-11-29",
            value: 61.86
    }, {
            time: "2018-11-30",
            value: 60.60
    }, {
            time: "2018-12-03",
            value: 63.16
    }, {
            time: "2018-12-04",
            value: 68.30
    }, {
            time: "2018-12-05",
            value: 67.20
    }, {
            time: "2018-12-06",
            value: 68.56
    }, {
            time: "2018-12-07",
            value: 71.30
    }, {
            time: "2018-12-10",
            value: 73.98
    }, {
            time: "2018-12-11",
            value: 72.28
    }, {
            time: "2018-12-12",
            value: 73.20
    }, {
            time: "2018-12-13",
            value: 73.00
    }, {
            time: "2018-12-14",
            value: 72.90
    }, {
            time: "2018-12-17",
            value: 73.96
    }, {
            time: "2018-12-18",
            value: 73.40
    }, {
            time: "2018-12-19",
            value: 73.00
    }, {
            time: "2018-12-20",
            value: 72.98
    }, {
            time: "2018-12-21",
            value: 72.80
    }, {
            time: "2018-12-24",
            value: 72.90
    }, {
            time: "2018-12-25",
            value: 74.20
    }, {
            time: "2018-12-26",
            value: 73.98
    }, {
            time: "2018-12-27",
            value: 74.50
    }, {
            time: "2018-12-28",
            value: 74.00
    }, {
            time: "2019-01-03",
            value: 73.50
    }, {
            time: "2019-01-04",
            value: 73.90
    }, {
            time: "2019-01-08",
            value: 73.90
    }, {
            time: "2019-01-09",
            value: 72.94
    }, {
            time: "2019-01-10",
            value: 69.86
    }, {
            time: "2019-01-11",
            value: 70.34
    }, {
            time: "2019-01-14",
            value: 68.78
    }, {
            time: "2019-01-15",
            value: 68.02
    }, {
            time: "2019-01-16",
            value: 66.60
    }, {
            time: "2019-01-17",
            value: 65.94
    }, {
            time: "2019-01-18",
            value: 68.00
    }, {
            time: "2019-01-21",
            value: 69.20
    }, {
            time: "2019-01-22",
            value: 69.76
    }, {
            time: "2019-01-23",
            value: 69.60
    }, {
            time: "2019-01-24",
            value: 69.62
    }, {
            time: "2019-01-25",
            value: 69.30
    }, {
            time: "2019-01-28",
            value: 69.20
    }, {
            time: "2019-01-29",
            value: 68.90
    }, {
            time: "2019-01-30",
            value: 66.40
    }, {
            time: "2019-01-31",
            value: 67.08
    }, {
            time: "2019-02-01",
            value: 69.78
    }, {
            time: "2019-02-04",
            value: 72.56
    }, {
            time: "2019-02-05",
            value: 72.74
    }, {
            time: "2019-02-06",
            value: 73.00
    }, {
            time: "2019-02-07",
            value: 73.38
    }, {
            time: "2019-02-08",
            value: 73.10
    }, {
            time: "2019-02-11",
            value: 73.22
    }, {
            time: "2019-02-12",
            value: 72.30
    }, {
            time: "2019-02-13",
            value: 74.86
    }, {
            time: "2019-02-14",
            value: 73.64
    }, {
            time: "2019-02-15",
            value: 73.38
    }, {
            time: "2019-02-18",
            value: 74.26
    }, {
            time: "2019-02-19",
            value: 75.00
    }, {
            time: "2019-02-20",
            value: 74.96
    }, {
            time: "2019-02-21",
            value: 75.00
    }, {
            time: "2019-02-22",
            value: 74.88
    }, {
            time: "2019-02-25",
            value: 74.96
    }, {
            time: "2019-02-26",
            value: 76.02
    }, {
            time: "2019-02-27",
            value: 77.30
    }, {
            time: "2019-02-28",
            value: 77.90
    }, {
            time: "2019-03-01",
            value: 78.24
    }, {
            time: "2019-03-04",
            value: 76.64
    }, {
            time: "2019-03-05",
            value: 78.74
    }, {
            time: "2019-03-06",
            value: 76.88
    }, {
            time: "2019-03-07",
            value: 75.32
    }, {
            time: "2019-03-11",
            value: 72.90
    }, {
            time: "2019-03-12",
            value: 74.78
    }, {
            time: "2019-03-13",
            value: 74.50
    }, {
            time: "2019-03-14",
            value: 75.34
    }, {
            time: "2019-03-15",
            value: 74.92
    }, {
            time: "2019-03-18",
            value: 75.08
    }, {
            time: "2019-03-19",
            value: 75.54
    }, {
            time: "2019-03-20",
            value: 76.78
    }, {
            time: "2019-03-21",
            value: 77.70
    }, {
            time: "2019-03-22",
            value: 77.34
    }, {
            time: "2019-03-25",
            value: 78.00
    }, {
            time: "2019-03-26",
            value: 77.98
    }, {
            time: "2019-03-27",
            value: 78.90
    }, {
            time: "2019-03-28",
            value: 78.30
    }, {
            time: "2019-03-29",
            value: 78.70
    }, {
            time: "2019-04-01",
            value: 77.22
    }, {
            time: "2019-04-02",
            value: 76.64
    }, {
            time: "2019-04-03",
            value: 76.50
    }, {
            time: "2019-04-04",
            value: 76.64
    }, {
            time: "2019-04-05",
            value: 75.46
    }, {
            time: "2019-04-08",
            value: 76.42
    }, {
            time: "2019-04-09",
            value: 77.76
    }, {
            time: "2019-04-10",
            value: 77.68
    }, {
            time: "2019-04-11",
            value: 76.60
    }, {
            time: "2019-04-12",
            value: 76.78
    }, {
            time: "2019-04-15",
            value: 76.28
    }, {
            time: "2019-04-16",
            value: 75.88
    }, {
            time: "2019-04-17",
            value: 76.38
    }, {
            time: "2019-04-18",
            value: 77.00
    }, {
            time: "2019-04-19",
            value: 77.40
    }, {
            time: "2019-04-22",
            value: 77.40
    }, {
            time: "2019-04-23",
            value: 78.20
    }, {
            time: "2019-04-24",
            value: 78.68
    }, {
            time: "2019-04-25",
            value: 78.66
    }, {
            time: "2019-04-26",
            value: 77.88
    }, {
            time: "2019-04-29",
            value: 78.02
    }, {
            time: "2019-04-30",
            value: 78.68
    }, {
            time: "2019-05-02",
            value: 78.14
    }, {
            time: "2019-05-03",
            value: 78.30
    }, {
            time: "2019-05-06",
            value: 80.06
    }, {
            time: "2019-05-07",
            value: 80.50
    }, {
            time: "2019-05-08",
            value: 80.76
    }, {
            time: "2019-05-10",
            value: 82.10
    }, {
            time: "2019-05-13",
            value: 83.72
    }, {
            time: "2019-05-14",
            value: 83.55
    }, {
            time: "2019-05-15",
            value: 84.92
    }, {
            time: "2019-05-16",
            value: 83.32
    }, {
            time: "2019-05-17",
            value: 83.04
    }, {
            time: "2019-05-20",
            value: 83.92
    }, {
            time: "2019-05-21",
            value: 84.24
    }, {
            time: "2019-05-22",
            value: 84.00
    }, {
            time: "2019-05-23",
            value: 84.26
    }, {
            time: "2019-05-24",
            value: 84.00
    }, {
            time: "2019-05-27",
            value: 83.80
    }, {
            time: "2019-05-28",
            value: 84.32
    }, {
            time: "2019-05-29",
            value: 83.88
    }, {
            time: "2019-05-30",
            value: 84.58
    }, {
            time: "2019-05-31",
            value: 81.20
    }, {
            time: "2019-06-03",
            value: 84.35
    }, {
            time: "2019-06-04",
            value: 85.66
    }, {
            time: "2019-06-05",
            value: 86.51
    }, ];

    var chart = window.tvchart = LightweightCharts.createChart(container, {
        width: width,
        height: height,
        layout: {
            background: {
                color: '#000000',
                // color: '#FFFFFF',
            },
            // lineColor: '#2B2B43',
            textColor: '#FFFFFF',
        },
        rightPriceScale: {
            scaleMargins: {
                top: 0.35,
                bottom: 0.2,
            },
            borderVisible: false,
        },
        timeScale: {
            borderVisible: false,
        },
        grid: {
            horzLines: {
                color: '#eee',
                visible: false,
            },
            vertLines: {
                color: '#ffffff',
                visible: false,
            },
        },
        crosshair: {
            horzLine: {
                visible: false,
                labelVisible: false
            },
            vertLine: {
                visible: true,
                style: 0,
                width: 2,
                // color: 'rgba(32, 38, 46, 0.1)',
                color: '#ffffff',
                labelVisible: false,
            }
        },
    });

    var series = chart.addAreaSeries({
        topColor: 'rgba(19, 68, 193, 0.4)',
        bottomColor: 'rgba(0, 120, 255, 0.0)',
        lineColor: 'rgba(19, 40, 153, 1.0)',
        lineWidth: 3
    });


    series.setData(data);
    var lastPrice = data[data.length - 1].value;
    var lastDate = {
        year: data[data.length - 1].time.split('-')[0],
        month: data[data.length - 1].time.split('-')[1],
        day: data[data.length - 1].time.split('-')[2],
    }
    var update_bar = {
        time: lastDate,
        value: lastPrice,
    }

    // The current update count.
    let curCnt = 0;
    // The expected end count.
    let endCnt = 10;

    var intervalId = setInterval(function() {
        update_bar.time = nextBusinessDay(update_bar.time);
        update_bar.value = update_bar.value + Math.random() * 3 - 1.9;
        console.log(update_bar.value)
        series.update(update_bar);

        if (curCnt++ >= endCnt) {
            clearInterval(intervalId);

            // 添加下载按钮。
            const downloadButton = document.createElement('button');
            downloadButton.id = 'download-button-demo1';
            downloadButton.className = 'btn btn-primary btn-block';
            downloadButton.textContent = 'Download Generated Order Flow';
            downloadButtonContainer.appendChild(downloadButton);
        }
    }, 1000);

    return intervalId;
}


function static_chart_demo2(contrainer) {

    var data = [
        {
            "time": "2018-10-19 09:30:00",
            "value": 54.9
    }, {
            "time": "2018-10-19 09:31:00",
            "value": 55.269523906998955
    }, {
            "time": "2018-10-19 09:32:00",
            "value": 55.666518045331486
    }, {
            "time": "2018-10-19 09:33:00",
            "value": 55.52478873543813
    }, {
            "time": "2018-10-19 09:34:00",
            "value": 55.2772455190891
    }, {
            "time": "2018-10-19 09:35:00",
            "value": 54.93171360685521
    }, {
            "time": "2018-10-19 09:36:00",
            "value": 55.12316430243682
    }, {
            "time": "2018-10-19 09:37:00",
            "value": 54.979451281593576
    }, {
            "time": "2018-10-19 09:38:00",
            "value": 55.02306619116549
    }, {
            "time": "2018-10-19 09:39:00",
            "value": 54.53285706740192
    }, {
            "time": "2018-10-19 09:40:00",
            "value": 54.97513598554735
    }, {
            "time": "2018-10-19 09:41:00",
            "value": 55.3956437854369
    }, {
            "time": "2018-10-19 09:42:00",
            "value": 55.69098871232832
    }, {
            "time": "2018-10-19 09:43:00",
            "value": 56.10748484512473
    }, {
            "time": "2018-10-19 09:44:00",
            "value": 55.92446382876648
    }, {
            "time": "2018-10-19 09:45:00",
            "value": 56.21630872622785
    }, {
            "time": "2018-10-19 09:46:00",
            "value": 56.555298258481464
    }, {
            "time": "2018-10-19 09:47:00",
            "value": 56.76117981348402
    }, {
            "time": "2018-10-19 09:48:00",
            "value": 56.58739152766626
    }, {
            "time": "2018-10-19 09:49:00",
            "value": 56.11259235716872
    }, {
            "time": "2018-10-19 09:50:00",
            "value": 56.52408896505911
    }, {
            "time": "2018-10-19 09:51:00",
            "value": 56.288088784650554
    }, {
            "time": "2018-10-19 09:52:00",
            "value": 56.555459127906154
    }, {
            "time": "2018-10-19 09:53:00",
            "value": 56.07976500884847
    }, {
            "time": "2018-10-19 09:54:00",
            "value": 56.045077335794566
    }, {
            "time": "2018-10-19 09:55:00",
            "value": 56.11505233977216
    }, {
            "time": "2018-10-19 09:56:00",
            "value": 56.29703226811447
    }, {
            "time": "2018-10-19 09:57:00",
            "value": 55.886718323568275
    }, {
            "time": "2018-10-19 09:58:00",
            "value": 55.81743875256354
    }, {
            "time": "2018-10-19 09:59:00",
            "value": 55.94870520920758
    }, {
            "time": "2018-10-19 10:00:00",
            "value": 55.4913254830681
    }, {
            "time": "2018-10-19 10:01:00",
            "value": 55.684944985257765
    }, {
            "time": "2018-10-19 10:02:00",
            "value": 55.57345841251078
    }, {
            "time": "2018-10-19 10:03:00",
            "value": 55.593276282603206
    }, {
            "time": "2018-10-19 10:04:00",
            "value": 55.224882000814944
    }, {
            "time": "2018-10-19 10:05:00",
            "value": 54.986887795464135
    }, {
            "time": "2018-10-19 10:06:00",
            "value": 55.1297442472345
    }, {
            "time": "2018-10-19 10:07:00",
            "value": 55.361460088833915
    }, {
            "time": "2018-10-19 10:08:00",
            "value": 55.22141209341364
    }, {
            "time": "2018-10-19 10:09:00",
            "value": 55.70869986613662
    }, {
            "time": "2018-10-19 10:10:00",
            "value": 55.42308854513893
    }, {
            "time": "2018-10-19 10:11:00",
            "value": 55.112737409377665
    }, {
            "time": "2018-10-19 10:12:00",
            "value": 55.20761138820558
    }, {
            "time": "2018-10-19 10:13:00",
            "value": 55.05696254920915
    }, {
            "time": "2018-10-19 10:14:00",
            "value": 54.86845207846768
    }, {
            "time": "2018-10-19 10:15:00",
            "value": 54.547104273463816
    }, {
            "time": "2018-10-19 10:16:00",
            "value": 54.43124285775943
    }, {
            "time": "2018-10-19 10:17:00",
            "value": 54.65403762471196
    }, {
            "time": "2018-10-19 10:18:00",
            "value": 54.42220591018873
    }, {
            "time": "2018-10-19 10:19:00",
            "value": 54.08250435668506
    }, {
            "time": "2018-10-19 10:20:00",
            "value": 53.85939560838646
    }, {
            "time": "2018-10-19 10:21:00",
            "value": 53.64578688466295
    }, {
            "time": "2018-10-19 10:22:00",
            "value": 54.00316832760297
    }, {
            "time": "2018-10-19 10:23:00",
            "value": 54.400694290004445
    }, {
            "time": "2018-10-19 10:24:00",
            "value": 54.273200477253795
    }, {
            "time": "2018-10-19 10:25:00",
            "value": 54.3740070876051
    }, {
            "time": "2018-10-19 10:26:00",
            "value": 54.833191519599175
    }, {
            "time": "2018-10-19 10:27:00",
            "value": 54.71347964978417
    }, {
            "time": "2018-10-19 10:28:00",
            "value": 54.90310075760569
    }, {
            "time": "2018-10-19 10:29:00",
            "value": 54.670521953653754
    }, {
            "time": "2018-10-19 10:30:00",
            "value": 54.471279566688146
    }]

    function getMinutesArray(startTime, endTime) {
        var start = new Date("2000-01-01 " + startTime);
        var end = new Date("2000-01-01 " + endTime);
        var minutesArray = [];

        while (start <= end) {
            minutesArray.push(start.toLocaleTimeString([], {
                hour12: false
            }));
            start.setMinutes(start.getMinutes() + 1);
        }

        return minutesArray;
    }
    const r1 = getMinutesArray("09:30:00", "11:30:00");
    r1.pop();
    var result = r1.concat(getMinutesArray("13:00:00", "15:00:00"));

    const data0 = splitData(result)

    // Each item: open，close，lowest，highest
    function splitData(rawData) {
        const categoryData = [];
        const values = [];
        const volume = [];
        const rollout = [];
        const TWAPData = [];
        const value2 = []
        for (var i = 0; i < 50; i++) {
            categoryData.push(rawData[i]);
            values.push(data[i].value);
            volume.push(Math.floor(Math.random() * 800));
            TWAPData.push(null);
            rollout.push(null);
            value2.push(null)


        }
        return {
            categoryData: categoryData,
            values: values,
            value2: value2,
            volume: volume,
            TWAP: TWAPData,
            rollout: rollout
        };
    }

    var myChart = echarts.init(contrainer);
    myChart.clear()
    var option;
    option = {
        tooltip: {
            show: true,
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            }
        },
        grid: {
            left: '5%',
            right: "10%",
            top: "5%",
            bottom: '5%'
        },
        dataZoom: [{
            type: 'inside',
            start: 0,
            end: 100
        }],
        xAxis: {
            type: 'category',
            data: data0.categoryData,
            boundaryGap: true,
            axisLabel: {
                formatter: function(value, index) {
                    if (value.indexOf('11:30') >= 0 || value.indexOf('13:00') >= 0) {
                        return "11:30/13:00"
                    }
                    return value.substring(0, 5); // 只显示日期部分，去掉年份
                },
                interval: 29,
                color: '#fff'
            },
            axisLine: {
                onZero: false,
                show: false
            },
            splitLine: {
                show: false
            },
            min: 'dataMin',
            max: 'dataMax'
        },
        yAxis: [{
            type: 'value',
            position: 'right',
            scale: true,
            splitArea: {
                show: false
            },
            splitLine: {
                show: false
            },
            min: 50,
            max: 60,
            axisLabel: {
                color: '#fff'
            }

        }, {
            type: 'value',
            position: 'left',
            splitLine: {
                show: false
            },
            show: false,
            min: 0,
            max: 3000,
            axisLabel: {
                color: '#fff',
                // show: false
            }
        }, ],
        series: [
            {
                name: 'Price',
                data: data0.values,
                type: 'line',
                symbol: 'none',
                yAxisIndex: 0,
                lineStyle: {
                    width: 3,
                    color: '#13acbf',
                },
                markLine: {
                    lineStyle: {
                        color: '#13acbf'
                    },
                    label: {
                        color: '#fff',
                        backgroundColor: '#235c66',
                        padding: [4, 8],
                        lineHeight: 16
                    },
                    data: [{
                        yAxis: data0.values[data0.values.length - 1],
                    }]
                },
                areaStyle: {
                    color: 'rgba(19, 93, 102, 0.46)'
                }
        },
            {
                name: 'Rollout Volume',
                type: 'bar',
                stack: 'one',
                yAxisIndex: 1,
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0,0,0,0.3)'
                    }
                },
                itemStyle: {
                    color: 'rgba(255,137, 95, 0.7)'
                },
                data: data0.rollout
    },
            {
                name: 'TWAP agent volume',
                type: 'bar',
                stack: 'one',
                yAxisIndex: 1,
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0,0,0,0.3)'
                    }
                },
                itemStyle: {
                    color: 'rgba(255,184, 137, 0.7)'
                },
                data: data0.TWAP
    },
            {

                name: 'Replay Volume',
                type: 'bar',
                data: data0.volume,
                stack: 'two',
                itemStyle: {
                    color: 'rgba(19,172,191,0.7)'
                },
                yAxisIndex: 1
        },
        ]
    };

    option && myChart.setOption(option);
}


function drawDemo2V1(contrainer, downloadButtonContainer) {

    var data = [
        {
            "time": "2018-10-19 09:30:00",
            "value": 54.9
    }, {
            "time": "2018-10-19 09:31:00",
            "value": 55.269523906998955
    }, {
            "time": "2018-10-19 09:32:00",
            "value": 55.666518045331486
    }, {
            "time": "2018-10-19 09:33:00",
            "value": 55.52478873543813
    }, {
            "time": "2018-10-19 09:34:00",
            "value": 55.2772455190891
    }, {
            "time": "2018-10-19 09:35:00",
            "value": 54.93171360685521
    }, {
            "time": "2018-10-19 09:36:00",
            "value": 55.12316430243682
    }, {
            "time": "2018-10-19 09:37:00",
            "value": 54.979451281593576
    }, {
            "time": "2018-10-19 09:38:00",
            "value": 55.02306619116549
    }, {
            "time": "2018-10-19 09:39:00",
            "value": 54.53285706740192
    }, {
            "time": "2018-10-19 09:40:00",
            "value": 54.97513598554735
    }, {
            "time": "2018-10-19 09:41:00",
            "value": 55.3956437854369
    }, {
            "time": "2018-10-19 09:42:00",
            "value": 55.69098871232832
    }, {
            "time": "2018-10-19 09:43:00",
            "value": 56.10748484512473
    }, {
            "time": "2018-10-19 09:44:00",
            "value": 55.92446382876648
    }, {
            "time": "2018-10-19 09:45:00",
            "value": 56.21630872622785
    }, {
            "time": "2018-10-19 09:46:00",
            "value": 56.555298258481464
    }, {
            "time": "2018-10-19 09:47:00",
            "value": 56.76117981348402
    }, {
            "time": "2018-10-19 09:48:00",
            "value": 56.58739152766626
    }, {
            "time": "2018-10-19 09:49:00",
            "value": 56.11259235716872
    }, {
            "time": "2018-10-19 09:50:00",
            "value": 56.52408896505911
    }, {
            "time": "2018-10-19 09:51:00",
            "value": 56.288088784650554
    }, {
            "time": "2018-10-19 09:52:00",
            "value": 56.555459127906154
    }, {
            "time": "2018-10-19 09:53:00",
            "value": 56.07976500884847
    }, {
            "time": "2018-10-19 09:54:00",
            "value": 56.045077335794566
    }, {
            "time": "2018-10-19 09:55:00",
            "value": 56.11505233977216
    }, {
            "time": "2018-10-19 09:56:00",
            "value": 56.29703226811447
    }, {
            "time": "2018-10-19 09:57:00",
            "value": 55.886718323568275
    }, {
            "time": "2018-10-19 09:58:00",
            "value": 55.81743875256354
    }, {
            "time": "2018-10-19 09:59:00",
            "value": 55.94870520920758
    }, {
            "time": "2018-10-19 10:00:00",
            "value": 55.4913254830681
    }, {
            "time": "2018-10-19 10:01:00",
            "value": 55.684944985257765
    }, {
            "time": "2018-10-19 10:02:00",
            "value": 55.57345841251078
    }, {
            "time": "2018-10-19 10:03:00",
            "value": 55.593276282603206
    }, {
            "time": "2018-10-19 10:04:00",
            "value": 55.224882000814944
    }, {
            "time": "2018-10-19 10:05:00",
            "value": 54.986887795464135
    }, {
            "time": "2018-10-19 10:06:00",
            "value": 55.1297442472345
    }, {
            "time": "2018-10-19 10:07:00",
            "value": 55.361460088833915
    }, {
            "time": "2018-10-19 10:08:00",
            "value": 55.22141209341364
    }, {
            "time": "2018-10-19 10:09:00",
            "value": 55.70869986613662
    }, {
            "time": "2018-10-19 10:10:00",
            "value": 55.42308854513893
    }, {
            "time": "2018-10-19 10:11:00",
            "value": 55.112737409377665
    }, {
            "time": "2018-10-19 10:12:00",
            "value": 55.20761138820558
    }, {
            "time": "2018-10-19 10:13:00",
            "value": 55.05696254920915
    }, {
            "time": "2018-10-19 10:14:00",
            "value": 54.86845207846768
    }, {
            "time": "2018-10-19 10:15:00",
            "value": 54.547104273463816
    }, {
            "time": "2018-10-19 10:16:00",
            "value": 54.43124285775943
    }, {
            "time": "2018-10-19 10:17:00",
            "value": 54.65403762471196
    }, {
            "time": "2018-10-19 10:18:00",
            "value": 54.42220591018873
    }, {
            "time": "2018-10-19 10:19:00",
            "value": 54.08250435668506
    }, {
            "time": "2018-10-19 10:20:00",
            "value": 53.85939560838646
    }, {
            "time": "2018-10-19 10:21:00",
            "value": 53.64578688466295
    }, {
            "time": "2018-10-19 10:22:00",
            "value": 54.00316832760297
    }, {
            "time": "2018-10-19 10:23:00",
            "value": 54.400694290004445
    }, {
            "time": "2018-10-19 10:24:00",
            "value": 54.273200477253795
    }, {
            "time": "2018-10-19 10:25:00",
            "value": 54.3740070876051
    }, {
            "time": "2018-10-19 10:26:00",
            "value": 54.833191519599175
    }, {
            "time": "2018-10-19 10:27:00",
            "value": 54.71347964978417
    }, {
            "time": "2018-10-19 10:28:00",
            "value": 54.90310075760569
    }, {
            "time": "2018-10-19 10:29:00",
            "value": 54.670521953653754
    }, {
            "time": "2018-10-19 10:30:00",
            "value": 54.471279566688146
    }];


    function getMinutesArray(startTime, endTime) {
        var start = new Date("2000-01-01 " + startTime);
        var end = new Date("2000-01-01 " + endTime);
        var minutesArray = [];

        while (start <= end) {
            minutesArray.push(start.toLocaleTimeString([], {
                hour12: false
            }));
            start.setMinutes(start.getMinutes() + 1);
        }

        return minutesArray;
    }
    const r1 = getMinutesArray("09:30:00", "11:30:00");
    r1.pop();
    var result = r1.concat(getMinutesArray("13:00:00", "15:00:00"));

    const data0 = splitData(result)
    var current = 50;

    // Each item: open，close，lowest，highest
    function splitData(rawData) {
        const categoryData = [];
        const values = [];
        const volume = [];
        const rollout = [];
        const TWAPData = [];
        const value2 = []
        for (var i = 0; i <= 50; i++) {
            categoryData.push(rawData[i]);
            values.push(data[i].value);
            volume.push(Math.floor(Math.random() * 800));
            TWAPData.push(null);
            rollout.push(null);
            if (i == 50) {

                value2.push(data[i].value)
            } else {

                value2.push(null)
            }


        }
        return {
            categoryData: categoryData,
            values: values,
            value2: value2,
            volume: volume,
            TWAP: TWAPData,
            rollout: rollout
        };
    }

    var myChart = echarts.init(contrainer);
    var option;
    option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'cross'
            }
        },
        grid: {
            left: '10%',
            right: "10%",
            top: "5%",
            bottom: '5%'
        },
        dataZoom: [{
            type: 'inside',
            start: 0,
            end: 100
        }],
        xAxis: {
            type: 'category',
            data: data0.categoryData,
            boundaryGap: true,
            axisLabel: {
                formatter: function(value, index) {
                    if (value.indexOf('11:30') >= 0 || value.indexOf('13:00') >= 0) {
                        return "11:30/13:00"
                    }
                    return value.substring(0, 5); // 只显示日期部分，去掉年份
                },
                interval: 29,
                color: '#fff'
            },
            axisLine: {
                onZero: false,
                show: false
            },
            splitLine: {
                show: false
            },
            // min: 'dataMin',
            // max: 'dataMax'
        },
        yAxis: [{
            type: 'value',
            position: 'right',
            scale: true,
            splitArea: {
                show: false
            },
            splitLine: {
                show: false
            },
            min: 50,
            max: 60,
            axisLabel: {
                color: '#fff'
            }

        }, {
            type: 'value',
            position: 'left',
            show: false,
            splitLine: {
                show: false
            },
            min: 0,
            max: 3000,
            axisLabel: {
                color: '#fff',
                // show: false
            }
        }, ],
        series: [
            {
                name: 'Price',
                data: data0.values,
                type: 'line',
                symbol: 'none',
                animation: false,
                yAxisIndex: 0,
                lineStyle: {
                    width: 3,
                    color: '#13acbf',
                },
                markLine: {
                    lineStyle: {
                        color: '#13acbf'
                    },
                    label: {
                        color: '#fff',
                        backgroundColor: '#235c66',
                        padding: [4, 8],
                        lineHeight: 16
                    },
                    animation: false,
                    data: [{
                        yAxis: data0.values[data0.values.length - 1],
                    }]
                },
                areaStyle: {
                    color: 'rgba(19, 93, 102, 0.46)'
                }
        },
            {
                name: 'Rollout Volume',
                animation: false,
                type: 'bar',
                stack: 'one',
                yAxisIndex: 1,
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0,0,0,0.3)'
                    }
                },
                itemStyle: {
                    color: 'rgba(255,137, 95, 0.6)'
                },
                data: data0.rollout
    },
            {
                name: 'TWAP agent volume',
                animation: false,
                type: 'bar',
                stack: 'one',
                yAxisIndex: 1,
                emphasis: {
                    itemStyle: {
                        shadowBlur: 10,
                        shadowColor: 'rgba(0,0,0,0.3)'
                    }
                },
                itemStyle: {
                    color: 'rgba(255,184, 137, 0.6)'
                },
                data: data0.TWAP
    },
            {

                name: 'Replay Volume',
                animation: false,
                type: 'bar',
                data: data0.volume,
                stack: 'two',
                itemStyle: {
                    color: 'rgba(19,172,191,0.6)'
                },
                yAxisIndex: 1
        },
            {
                name: 'Simulate Price',
                data: data0.value2,
                type: 'line',
                symbol: 'none',
                animation: false,
                yAxisIndex: 0,
                lineStyle: {
                    width: 3,
                    color: 'rgba(197, 124, 97, 1)',
                },
                markLine: {
                    lineStyle: {
                        color: 'rgba(197, 124, 97, 1)'
                    },
                    animation: false,
                    label: {
                        color: '#fff',
                        backgroundColor: 'rgba(197, 124, 97, 1)',
                        padding: [4, 8],
                        lineHeight: 16
                    },
                    data: [{
                        yAxis: data0.values[data0.values.length - 1],
                    }]
                },
        },
        ]
    };

    option && myChart.setOption(option);


    var n = 5;
    var markpointArr = []
    var intervalId = setInterval(function() {
        if (current > result.length) {
            //     // 添加下载按钮。
            const downloadButton = document.createElement('button');
            downloadButton.id = 'download-button-demo2';
            downloadButton.className = 'btn btn-primary btn-block';
            downloadButton.textContent = 'Download Generated Order Flow';
            downloadButtonContainer.appendChild(downloadButton);
            clearInterval(chartIntervalId)
        }
        if (n < 5) {
            n++;
        } else {
            n = 0
            current++;
        }
        if (current % 5 == 0 && n == 0) {
            markpointArr.push({
                value: 'S',
                symbolSize: 30,
                itemStyle: {
                    color: '#ea5760'
                },
                animation: false,
                label: {
                    color: '#fff'
                },
                xAxis: data0.value2.length - 1,
                yAxis: data0.value2[data0.value2.length - 1] + 0.2
            });
            markpointArr.push({
                value: 'B',
                symbolRotate: 180,
                symbolSize: 30,
                itemStyle: {
                    color: '#4fc787'
                },
                animation: false,
                label: {
                    offset: [0, 7],
                    color: '#fff'
                },
                xAxis: data0.value2.length - 1,
                yAxis: data0.value2[data0.value2.length - 1] - 0.2
            })
        }
        $('#tooltip').hide();
        data0.categoryData[current] = result[current];
        data0.values[current] = data[Math.floor(Math.random() * 60)].value;
        data0.volume[current] = data0.volume[current] ? Math.floor(Math.random() * 200) + data0.volume[current] : Math.floor(Math.random() * 200);
        data0.TWAP[current] = data0.TWAP[current] ? data0.TWAP[current] + Math.floor(Math.random() * 100) : Math.floor(Math.random() * 100);
        data0.rollout[current] = data0.rollout[current] ? data0.rollout[current] + Math.floor(Math.random() * 100) : Math.floor(Math.random() * 100);
        data0.value2[current] = data[Math.ceil(Math.random() * 50)].value;
        if (data0.TWAP[current] > 300) {
            $('#tooltip').text('TWAP agent 成交量占比超过xx%').show();
        }


        myChart.setOption({
            xAxis: {
                data: data0.categoryData
            },
            series: [
                {
                    data: data0.values,
                    markLine: {
                        data: [{
                            yAxis: data0.values[data0.values.length - 1],
                    }]
                    },
                },

                {
                    data: data0.rollout
                },
                {
                    data: data0.TWAP
                },
                {
                    data: data0.volume
                },
                {
                    data: data0.value2,
                    markLine: {
                        data: [{
                            yAxis: data0.value2[data0.value2.length - 1],
                    }]
                    },

                    markPoint: {
                        data: markpointArr
                    },
                },
        ]
        })
    }, 200);

    return intervalId;
}

// 1
function drawChart2(contrainer) {
    console.log(2)
    const lightTheme = {
        chart: {
            layout: {
                background: {
                    type: 'solid',
                    // color: '#FFFFFF',
                    color: '#fafaf7',
                    // color: '#000000',
                },
                lineColor: '#2B2B43',
                textColor: '#191919',
            },
            watermark: {
                color: 'rgba(0, 0, 0, 0)',
            },
            grid: {
                vertLines: {
                    visible: false,
                },
                horzLines: {
                    color: '#f0f3fa',
                    // visible: false,
                },
            },
        },
        series: {
            // topColor: 'rgba(33, 150, 243, 0.56)',
            // bottomColor: 'rgba(33, 150, 243, 0.04)',
            // lineColor: 'rgba(33, 150, 243, 1)',
            // topColor: '#77B0AA',
            // bottomColor: '#E3FEF7',
            topColor: 'rgba(19, 93, 102, 0.56)',
            bottomColor: 'rgba(19, 93, 102, 0.04)',
            lineColor: '#135D66',
        },
    };

    var chart = LightweightCharts.createChart(contrainer, {
        width: 850,
        height: 550,
        textColor: 'black',
        rightPriceScale: {
            borderVisible: false,
        },
        timeScale: {
            borderVisible: true,
            borderColor: '#222',
            timeVisible: true,
            secondsVisible: false,
            barSpacing: 10,
        },
    });

    var areaSeries = chart.addAreaSeries({
        // topColor: 'rgba(33, 150, 243, 0.56)',
        // bottomColor: 'rgba(33, 150, 243, 0.04)',
        topColor: 'rgba(197, 124, 97, 0.56)',
        bottomColor: 'rgba(197, 124, 97, 0.04)',
        lineColor: 'rgba(197, 124, 97, 1)',
        lineWidth: 3,
    });

    var areaSeries2 = chart.addAreaSeries({
        // topColor: 'rgba(33, 150, 243, 0.56)',
        // bottomColor: 'rgba(33, 150, 243, 0.04)',
        topColor: 'rgb(209, 124, 93, 0.56)',
        bottomColor: 'rgb(209, 124, 93, 0.04)',
        lineColor: '#fafaf7',
        lineWidth: 3,
    });

    // Customizing the Crosshair
    chart.applyOptions({
        crosshair: {
            // Change mode from default 'magnet' to 'normal'.
            // Allows the crosshair to move freely without snapping to datapoints
            mode: LightweightCharts.CrosshairMode.Normal,

            // Vertical crosshair line (showing Date in Label)
            vertLine: {
                width: 8,
                color: 'rgba(194, 193, 188, 0.4)',
                style: LightweightCharts.LineStyle.Solid,
                labelBackgroundColor: '#008DDA',
            },

            // Horizontal crosshair line (showing Price in Label)
            horzLine: {
                color: '#008DDA',
                labelBackgroundColor: '#008DDA',
            },
        },
    });

    var _data = [
        {
            time: '2018-10-19 09:30:00',
            value: 54.90
    }, {
            time: '2018-10-19 09:31:00',
            value: 54.98
    }, {
            time: '2018-10-19 09:32:00',
            value: 57.21
    }, {
            time: '2018-10-19 09:33:00',
            value: 57.42
    }, {
            time: '2018-10-19 09:34:00',
            value: 56.43
    }, {
            time: '2018-10-19 09:35:00',
            value: 55.51
    }, {
            time: '2018-10-19 09:36:00',
            value: 56.48
    }, {
            time: '2018-10-19 09:37:00',
            value: 58.18
    }, {
            time: '2018-10-19 09:38:00',
            value: 57.09
    }, {
            time: '2018-10-19 09:39:00',
            value: 56.05
    }, {
            time: '2018-10-19 09:40:00',
            value: 56.63
    }, {
            time: '2018-10-19 09:41:00',
            value: 57.21
    }, {
            time: '2018-10-19 09:42:00',
            value: 57.21
    }, {
            time: '2018-10-19 09:43:00',
            value: 57.65
    }, {
            time: '2018-10-19 09:44:00',
            value: 58.27
    }, ];

    var data = _data.map(item => {
        return {
            time: convertToUnixTimestamp(item.time),
            value: item.value,
        };
    });

    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    async function updateData() {
        areaSeries.setData([data[0]]);
        areaSeries2.setData([data[0]]);
        chart.applyOptions(lightTheme.chart);
        // areaSeries.applyOptions(lightTheme.series);
        areaSeries2.applyOptions(lightTheme.series);
        chart.timeScale().fitContent();

        for (let i = 1; i < data.length; i++) {
            const update_bar = {
                time: data[i].time,
                value: data[i].value,
            };
            console.log(i, update_bar);
            areaSeries.update(update_bar);
            areaSeries2.update(update_bar);

            await delay(50);
            chart.timeScale().fitContent();
        }

        var lastPrice = data[data.length - 1].value;
        var lastPrice2 = data[data.length - 1].value;
        var lastIndex = data.length - 1;

        var targetIndex = lastIndex + 21 + Math.round(Math.random() + 30);
        var targetPrice = getRandomPrice();
        var targetPrice2 = getRandomPrice2();

        var currentIndex = lastIndex + 1;
        var currentBusinessDayTime = addMinute(data[data.length - 1].time, 1);
        var ticksInCurrentBar = 0;
        var currentBar = {
            value: null,
            time: currentBusinessDayTime,
        };
        var currentBar2 = {
            value: null,
            time: currentBusinessDayTime,
        };

        function mergeTickToBar(value, value2) {
            currentBar.value = value;
            areaSeries.update(currentBar);
            currentBar2.value = value2;
            areaSeries2.update(currentBar2);
        }

        function reset() {
            areaSeries.setData(data);
            areaSeries2.setData(data);

            lastPrice = data[data.length - 1].value;
            lastPrice2 = data[data.length - 1].value;
            lastIndex = data.length - 1;

            targetIndex = lastIndex + 5 + Math.round(Math.random() + 30);
            targetPrice = getRandomPrice();
            targetPrice2 = getRandomPrice2();

            currentIndex = lastIndex + 1;
            currentBusinessDay = {
                day: 29,
                month: 5,
                year: 2019
            };
            ticksInCurrentBar = 0;
        }

        function getRandomPrice() {
            return 10 + Math.round(Math.random() * 10000) / 100;
        }

        function getRandomPrice2() {
            return 10 + Math.round(Math.random() * 10000) / 100;
        }

        setInterval(function() {
            var deltaY = targetPrice - lastPrice;
            var deltaX = targetIndex - lastIndex;
            var angle = deltaY / deltaX;
            var basePrice = lastPrice + (currentIndex - lastIndex) * angle;
            var noise = (0.1 - Math.random() * 0.1) + 1.0;
            var noisedPrice = basePrice * noise;

            var deltaY2 = targetPrice2 - lastPrice2;
            var deltaX2 = targetIndex - lastIndex;
            var angle2 = deltaY2 / deltaX2;
            var basePrice2 = lastPrice2 + (currentIndex - lastIndex) * angle2;
            var noise2 = (0.1 - Math.random() * 0.1) + 1.0;
            var noisedPrice2 = basePrice2 * noise2;

            mergeTickToBar(noisedPrice, noisedPrice2);
            if (++ticksInCurrentBar === 1) {
                // move to next bar
                currentIndex++;
                currentBusinessDayTime = addMinute(currentBusinessDayTime);
                currentBar = {
                    value: null,
                    time: currentBusinessDayTime,
                };
                currentBar2 = {
                    value: null,
                    time: currentBusinessDayTime,
                };
                ticksInCurrentBar = 0;
                if (currentIndex === 5000) {
                    reset();
                    return;
                }
                if (currentIndex === targetIndex) {
                    // change trend
                    lastPrice = noisedPrice;
                    lastPrice2 = noisedPrice2;
                    lastIndex = currentIndex;
                    targetIndex = lastIndex + 1 + Math.round(Math.random() + 30);
                    targetPrice = getRandomPrice();
                    targetPrice2 = getRandomPrice2();
                }
            }
            chart.timeScale().fitContent();
        }, 1000);
    }
    updateData();
}


function generateOrderLevels(type, count, basePrice, fix = false) {
    const levels = [];
    const priceVariation = 5; // 价格变动范false围
    if (fix) {
        // 固定种子
        console.log("Fix Seed")
        const fixedSeed = 123456;
        random = new SeedRandom(fixedSeed);
    } else {
        // 随机种子
        random = {
            nextFloat: () => Math.random()
        };
    }

    for (let i = 0; i < count; i++) {
        const priceOffset = random.nextFloat() * priceVariation;
        const price = type === 'bid' ?
            (basePrice - priceOffset).toFixed(2) :
            (basePrice + priceOffset).toFixed(2);
        const volume = Math.floor(random.nextFloat() * 1000 + 100);
        levels.push({
            price,
            volume
        });
    }

    // return levels.sort((a, b) => type === 'bid' ? b.price - a.price : b.price - a.price);
    return levels.sort((a, b) => b.price - a.price);
}


function updateOrderbook(bidsContainer, asksContainer, basePrice, fix = false) {
    const bids = generateOrderLevels('bid', 5, basePrice, fix);
    const asks = generateOrderLevels('ask', 5, basePrice, fix);

    bidsContainer.innerHTML = bids.map(bid => `<tr><td class="bid-level price-col">${bid.price}</td><td class="volume-col">${bid.volume}</td></tr>`).join('');
    asksContainer.innerHTML = asks.map(ask => `<tr><td class="ask-level price-col">${ask.price}</td><td class="volume-col">${ask.volume}</td></tr>`).join('');
}