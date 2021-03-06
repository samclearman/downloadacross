// parses WSJ's puzzle format
// first fetches WSJ's daily puzzle page, then fetches the daily crossword (if it exists)
// finally, fetches the raw data url, then parses the data from raw data url
// example crossword page: 
// example puzzle page: https://blogs.wsj.com/puzzle/2017/11/21/
// example raw data url: https://blogs.wsj.com/puzzle/crossword/20171122/28895/data.json

// convert from WSJ's raw gamePageData object to standard puzzle format
var convertRawWSJ = function(raw, date) {
  console.log(raw);
  var data = raw.data;
  var grid = data.grid.map(function(row) {
    return row.map(function(cell) {
      return cell.Letter || '.';
    });
  });
  var cols = data.grid[0].length;
  var circles = [];
  data.grid.forEach(function(row, i) {
    row.forEach(function(cell, j) {
      if (cell.style && cell.style.shapebg === 'circle') {
        circles.push(i * cols + j);
      }
    });
  });

  var rows = grid[0].length,
    cols = grid.length;

  var title = 'WSJ ' + date.date.toLocaleDateString("en-US", { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: "UTC" });
  if (data.copy.title) {
    title += ' ' + data.copy.title;
  }
  var meta = {
    title: title,
    description: data.copy.description,
    author: data.copy.setter.substring('By '),
    copyright: 'The Wall Street Journal',
  };

  function getClues(clues, dir) {
    var result = [];
    clues.forEach(function(clue) {
      var num = parseInt(clue.number);
      var text = clue.clue;
      result[num] = text;
    });
    return result;
  }

  var clues = {
    across: getClues(data.copy.clues[0].clues),
    down: getClues(data.copy.clues[1].clues),
  };

  var filename = 'wsj' + date.str + date.dayOfWeekStr + '.puz';

  return {
    meta: meta,
    grid: grid,
    clues: clues,
    circles: circles,
    filename: filename,
  };
}

function extractAllLinks(doc) {
  var result = [];
  var i = -1;
  i = doc.indexOf('a href', i + 1);
  while (i !== -1) {
    var quote1 = doc.indexOf('"', i);
    var quote2 = doc.indexOf('"', quote1 + 1);
    if (quote1 !== -1 && quote2 !== -1) {
      result.push(doc.substring(quote1 + 1, quote2));
    }
    i = doc.indexOf('a href', i + 1);
  }
  return result;
}


function extractWSJPuzzleURLs(doc, url) {
  return extractAllLinks(doc).filter(function(link) {
    return (link.indexOf('crossword') !== -1 && link.indexOf(url) !== -1);
  });
}

function extractWSJPuzzleID(doc) {
  var result;
  extractAllLinks(doc).forEach(function(link) {
    if (link.indexOf('//blogs.wsj.com/puzzle/crossword/') !== -1 && link.indexOf('/index.html') !== -1) {
      var start = link.indexOf('crossword/') + 'crossword/'.length;
      var end = link.indexOf('/index.html');
      // then result = '20171109/28457'
      result = link.substring(start, end);
    }
  });
  return result;
}

function getWSJDailyLink(date) {
  var url1 = `https://blogs.wsj.com/puzzle/${date.strSlashes}/`;
  var url2 = `https://blogs.wsj.com/puzzle/${date.yesterday().strSlashes}/`;
  return load(url2)
    .then(function(responseYDay) {
      console.log('got responseYDay');
      var puzzleURLs = (responseYDay && extractWSJPuzzleURLs(responseYDay, url2)) || [];
      if (puzzleURLs.length === 1) {
        // wed, fri, sat
        return puzzleURLs[0];
      } else if (puzzleURLs.length >= 2) {
        // tuesday?
        console.log(puzzleURLs);
        return puzzleURLs[0];
      } else {
        throw new Error();
      }
    }).catch(function() {
      return load(url1)
        .then(function(responseToday) {
          if (!responseToday) throw new Error('empty response')
          var puzzleURLs2 = extractWSJPuzzleURLs(responseToday, url1);
          if (puzzleURLs2.length >= 1) {
            // monday
            if (puzzleURLs2.length >= 2) {
              var mondays = puzzleURLs2.filter(function(url) {
                return url.indexOf('monday') !== -1;
              });
              return mondays[0];
            } else {
              return puzzleURLs[0];
            }
          }
        });
    });
}

function getWSJURL(date) {
  return getWSJDailyLink(date)
    .then(function(puzzleURL) {
      console.log('found daily link', puzzleURL);
      return load(puzzleURL)
    }).then(function(body) {
      var puzzleId = extractWSJPuzzleID(body);
      var dataURL = `https://blogs.wsj.com/puzzle/crossword/${puzzleId}/data.json`;
      return dataURL;
    });
}

function loadWSJ(url, date) {
  return load(url)
    .then(function(body) {
      var raw = JSON.parse(body);
      var puzzle = convertRawWSJ(raw, date);
      if (!puzzle) {
        throw new Error('failed to load wsj');
      }
      var ratingUrl = `http://crosswordfiend.com/ratings_count_json.php?puzz=${date.strHyphens}-wsj`;
      return getCFRating(ratingUrl).then(function(rating) {
        if (rating) {
          puzzle.rating = rating;
          var link = `http://crosswordfiend.com/${date.yesterday().strSlashes}/${date.strHyphens}/#wsj`;
          puzzle.rating.link = link;
        }
        console.log('got CF rating', puzzle);
        return puzzle;
      });
    }
  );
}

var WSJLoader = {
  load: function(date) {
    return getWSJURL(date)
      .then(function(url) {
        console.log('wsj url:', url);
        return loadWSJ(url, date);
      });
  },
  origins: [
    'http://blogs.wsj.com/*',
    'https://blogs.wsj.com/*',
    'http://crosswordfiend.com/*',
    'https://crosswordfiend.com/*',
  ],
};
