var puzzle = null;

var loaders = {
  'LA Times': LATimesLoader,
  'WSJ': WSJLoader,
  'New York Times': NYTimesLoader,
  'USA Today': USATodayLoader,
};

var months = [ null, 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var daysOfWeek = [ 'sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat' ];

var curhash = ''; // empty
var puzzles = {};
var tagged;
var saved = {};

function loadState(cbk) {
  chrome.storage.sync.get({
    tagged: {},
  }, function(items) {
    if (items) {
      tagged = items.tagged;
      console.log('loaded', tagged);
    }
    cbk();
  });
}

function saveState() {
  if (!tagged) return;
  console.log('saving', tagged);
  chrome.storage.sync.set({
    tagged: tagged,
  });
}

function getSource() {
  return document.querySelector('.source-select--item.selected').textContent;
}

function pad(num, len, sep) {
  if (!sep) sep = '0';
  num = num + '';
  while (num.length < len) {
    num = sep + num;
  }
  return num;
}

function makeDate(year, month, day) {
  var date = new Date(year, month - 1, day);
  return {
    day: day,
    month: month,
    year: year,
    date: date,
    str: (parseInt(day) + parseInt(month) * 100 + (parseInt(year) % 100) * 10000) + '',
    dayOfWeek: date.getDay(),
    dayOfWeekStr: daysOfWeek[date.getDay()],
    strSlashes: pad(year, 4) + '/' + pad(month, 2) + '/' + pad(day, 2),
  };
}

function getDate() {
  var month = document.querySelector('.calendar--month').textContent;
  var year = document.querySelector('.calendar--year').textContent;
  var selectedDayEl =  document.querySelector('.calendar--day.selected');

  var day = selectedDayEl && selectedDayEl.textContent;
  if (!day) return null;

  day = parseInt(day);
  month = months.indexOf(month);
  year = parseInt(year);
  return makeDate(year, month, day);
}

function getHash(source, year, month, day) {
  var date = makeDate(year, month, day);
  return source + date.str;
}

function update() {
  var source = getSource();
  var loader = loaders[source];
  var date = getDate();
  if (!date) {
    curhash = 'nodate';
    render();
    return;
  }
  var hash = getHash(source, date.year, date.month, date.day);
  if (hash !== curhash) {
    curhash = hash;
    render();
  }
  if (!puzzles[hash]) {
    console.log('grabbing', source, date);
    loader.load(date, function(_puzzle) {
      puzzles[hash] = _puzzle;
      render();
    });
  }
}

function renderPuzzleInfo() {
  var puzzle = puzzles[curhash];
  var title = document.querySelector('.title');
  var author = document.querySelector('.author');
  if (puzzle) {
    title.innerHTML = puzzle.meta.title;
    author.innerHTML = puzzle.meta.author;
  } else {
    title.innerHTML = '...';
    author.innerHTML = '...';
  }
}

function daysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

function renderCalendar() {
  var month = document.querySelector('.calendar--month').textContent;
  var year = document.querySelector('.calendar--year').textContent;
  var source = getSource();
  month = months.indexOf(month);
  year = parseInt(year);
  var days = daysInMonth(month, year);
  var num = 1 - (new Date(year, month - 1, 1).getDay()); // 0-6
  var row = 0;

  var weekEls = document.querySelectorAll('.calendar--week');
  if (weekEls.length === 0) {
    var calendarEl = document.querySelector('.calendar');
    for (var row = 0; row < 5; row += 1) {
      var weekEl = document.createElement('div');
      weekEl.classList.add('calendar--week');
      calendarEl.appendChild(weekEl);
      for (var col = 0; col < 7; col += 1) {
        var day = document.createElement('div');
        day.classList.add('calendar--day');
        var text = document.createElement('span');
        day.appendChild(text);
        var tag = document.createElement('div');
        tag.classList.add('tag');
        day.appendChild(tag);
        weekEl.appendChild(day);
      }
    }
    weekEls = document.querySelectorAll('.calendar--week');
  }
  var selected = document.querySelector('.selected');
  for (var row = 0; row < 5; row += 1) {
    for (var col = 0; col < 7; col += 1) {
      var el = weekEls[row].children[col];
      var text = el.children[0];
      if (num <= 0 || num > days) {
        text.innerHTML = '';
        el.classList.add('gone');
        el.classList.remove('selected');
      } else {
        text.innerHTML = num;
        el.classList.remove('gone');
        if (!selected) {
          if (num === 1) {
            el.classList.add('selected');
          }
        }

        var hash = getHash(source, year, month, num);
        if (tagged && tagged[hash]) {
          el.classList.add('tagged');
        } else {
          el.classList.remove('tagged');
        }
      }
      num += 1;
    }
  }
}

function render() {
  saveState();
  renderPuzzleInfo();
  renderCalendar();
}

function registerSourceClickEvents() {
  var sources = document.querySelectorAll('.source-select--item');
  sources.forEach(function(el) {
    el.onclick = function() {
      document.querySelector('.source-select--item.selected').classList.remove('selected');
      el.classList.add('selected');
      update();
    }
  });
}

function registerDayClickEvents() {
  var days = document.querySelectorAll('.calendar--day');
  days.forEach(function(el) {
    el.onclick = function() {
      if (!el.classList.contains('gone')) {
        var selected = document.querySelector('.calendar--day.selected');
        selected && selected.classList.remove('selected');
        el.classList.add('selected');
        update();
      }
    }
  });
}

function registerDownloadClickEvent() {
  var download = document.querySelector('.btn.download');
  download.onclick = function() {
    console.log('click');
    var puzzle = puzzles[curhash];
    if (puzzle) {
      console.log('downloading to ', puzzle.filename);
      downloadBlob(puz.encode(puzzle), puzzle.filename);
      if (tagged) {
        tagged[curhash] = true;
      }
      render();
    }
  };
}

loadState(function() {
  render();
  registerSourceClickEvents();
  registerDayClickEvents();
  registerDownloadClickEvent();
});
